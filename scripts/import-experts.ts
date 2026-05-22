/**
 * One-shot xlsx → experts.json importer. Reads the "Expert QA Pool" sheet
 * from a workbook on disk and writes `data/experts.json` with one record
 * per row that has both a Name and a Contact Email. Rows missing either
 * field are skipped (they need to be chased offline before they can log in).
 *
 * Usage:
 *   npx tsx scripts/import-experts.ts "/path/to/Expert list - CORFO MEED+.xlsx"
 *
 * Re-running is safe and idempotent: it rewrites the JSON in full, sorted
 * by the order rows appear in the sheet. Stable expertIds are derived from
 * the email local part so a later re-import doesn't reshuffle DB keys.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// We rely on the openpyxl-dumped JSON for simplicity — easier than wiring
// a node xlsx library. We invoke openpyxl via a sibling Python one-liner
// (kept inline so the script stays self-contained).
import { execSync } from "node:child_process";

const DATA = join(process.cwd(), "data");

function readSheet(path: string): unknown[][] {
  const py = `
import openpyxl, json, sys
wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
ws = wb['Expert QA Pool']
print(json.dumps([list(r) for r in ws.iter_rows(values_only=True)]))
`.trim();
  const out = execSync(`python3 -c "${py.replace(/"/g, '\\"')}" "${path}"`, {
    encoding: "utf-8",
    maxBuffer: 5_000_000,
  });
  return JSON.parse(out);
}

function slugifyEmail(email: string): string {
  // jmvaldes@uc.cl → "jmvaldes"
  // ramon.riveros@subdere.gov.cl → "ramon_riveros"
  const local = email.split("@")[0] ?? "";
  return local
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeSector(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (s.includes("cross-sector") || s.includes("transversal")) return "Transversal";
  if (s.includes("energ")) return "Energía";
  if (s.includes("transport")) return "Transporte";
  if (s.includes("waste") || s.includes("residuo")) return "Residuos";
  if (s.includes("ippu") || s.includes("industri")) return "IPPU";
  if (s.includes("afolu") || s.includes("agro") || s.includes("forest")) return "AFOLU";
  return null;
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: npx tsx scripts/import-experts.ts "/path/to/workbook.xlsx"');
    process.exit(1);
  }
  const rows = readSheet(file);
  if (rows.length === 0) {
    console.error("No rows read from sheet.");
    process.exit(1);
  }
  const [header, ...body] = rows as string[][];
  const colIndex = (name: string) =>
    header.findIndex((h) => (h ?? "").toString().trim().toLowerCase() === name.toLowerCase());
  const idxName = colIndex("Name");
  const idxEmail = colIndex("Contact Email");
  const idxSector = colIndex("Sector");
  const idxExpertise = colIndex("Expertise Area (More especific)");
  const idxOrg = colIndex("Organization");
  if (idxName < 0 || idxEmail < 0) {
    console.error("Sheet header missing Name or Contact Email columns.");
    process.exit(1);
  }

  const out: Array<{
    expertId: string;
    email: string;
    fullName: string;
    sectorSpecialization: string | null;
    organization?: string;
  }> = [];
  const seenIds = new Set<string>();
  const seenEmails = new Set<string>();
  let skippedNoName = 0;
  let skippedNoEmail = 0;

  for (const row of body) {
    const name = (row[idxName] ?? "").toString().trim();
    const email = (row[idxEmail] ?? "").toString().trim();
    if (!name) {
      skippedNoName++;
      continue;
    }
    if (!email) {
      skippedNoEmail++;
      continue;
    }
    const lowerEmail = email.toLowerCase();
    if (seenEmails.has(lowerEmail)) continue;
    seenEmails.add(lowerEmail);

    let id = slugifyEmail(email);
    if (seenIds.has(id)) {
      let n = 2;
      while (seenIds.has(`${id}_${n}`)) n++;
      id = `${id}_${n}`;
    }
    seenIds.add(id);

    const sectorRaw = idxSector >= 0 ? row[idxSector] : null;
    const expertiseRaw = idxExpertise >= 0 ? row[idxExpertise] : null;
    const sectorSpecialization =
      normalizeSector(sectorRaw as string) ?? normalizeSector(expertiseRaw as string);

    out.push({
      expertId: id,
      email: lowerEmail,
      fullName: name,
      sectorSpecialization,
      organization: idxOrg >= 0 && row[idxOrg] ? String(row[idxOrg]).trim() : undefined,
    });
  }

  writeFileSync(join(DATA, "experts.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`✓ Wrote ${out.length} experts to data/experts.json`);
  if (skippedNoName > 0) console.log(`  skipped ${skippedNoName} rows with no name`);
  if (skippedNoEmail > 0)
    console.log(`  skipped ${skippedNoEmail} rows with no email — chase these offline:`);

  // Echo the names that are missing emails so Carlos can chase
  for (const row of body) {
    const name = (row[idxName] ?? "").toString().trim();
    const email = (row[idxEmail] ?? "").toString().trim();
    if (name && !email) console.log(`    · ${name}`);
  }
}

main();
