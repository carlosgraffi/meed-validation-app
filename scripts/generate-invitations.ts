/**
 * One-shot magic-link generator for the expert panel.
 *
 * For every expert in data/experts.json:
 *   1. Ensure the DB row exists (upserts via Prisma).
 *   2. Invalidate any active magic tokens for that expert.
 *   3. Mint a fresh single-token URL.
 *
 * Emits the result in three formats so Carlos has a choice for distribution:
 *   - stdout markdown table (easy to skim, easy to paste into Slack/Notion)
 *   - data/_invitations.csv (one row per expert; can be loaded into mail
 *     merge in Gmail/Outlook/etc.)
 *   - data/_invitations.json (programmatic access)
 *
 * The CSV + JSON files are gitignored — they contain live magic links and
 * shouldn't be committed.
 *
 * Usage:
 *   npx tsx scripts/generate-invitations.ts                  # → http://localhost:3001
 *   npx tsx scripts/generate-invitations.ts https://meed-testing.up.railway.app
 *
 * Or against production via Railway CLI:
 *   railway run npx tsx scripts/generate-invitations.ts \
 *     https://meed-testing.up.railway.app
 *
 * After running, hand the CSV to SSG to email out.
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadExperts } from "../lib/fixtures";

const prisma = new PrismaClient();

async function main() {
  const baseUrl =
    process.argv[2] ?? process.env.NEXTAUTH_URL ?? "http://localhost:3001";
  const ttlMin = parseInt(process.env.MAGIC_LINK_TTL_MIN ?? "10080", 10);
  const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000);

  const experts = loadExperts();
  console.log(`→ Generating invitations for ${experts.length} experts…`);
  console.log(`  Base URL:  ${baseUrl}`);
  console.log(`  Expires:   ${expiresAt.toISOString()} (in ${ttlMin} minutes)\n`);

  const out: Array<{
    expertId: string;
    fullName: string;
    email: string;
    organization?: string;
    magicLink: string;
    expiresAt: string;
  }> = [];

  for (const e of experts) {
    // Upsert the DB row in case experts.json drifted from the DB.
    await prisma.expert.upsert({
      where: { id: e.expertId },
      create: {
        id: e.expertId,
        email: e.email.toLowerCase(),
        fullName: e.fullName,
        sectorSpecialization: e.sectorSpecialization,
      },
      update: {
        email: e.email.toLowerCase(),
        fullName: e.fullName,
        sectorSpecialization: e.sectorSpecialization,
      },
    });

    // Invalidate previous active tokens so old ones stop working — Carlos
    // gets to control distribution from this one shot only.
    await prisma.magicToken.updateMany({
      where: { expertId: e.expertId, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    const token = randomBytes(32).toString("base64url");
    await prisma.magicToken.create({
      data: { token, expertId: e.expertId, expiresAt },
    });

    out.push({
      expertId: e.expertId,
      fullName: e.fullName,
      email: e.email,
      organization: e.organization,
      magicLink: `${baseUrl}/auth/magic/${token}`,
      expiresAt: expiresAt.toISOString(),
    });
  }

  // Markdown table to stdout
  console.log("| Expert | Email | Organization | Magic link |");
  console.log("|---|---|---|---|");
  for (const r of out) {
    const safeOrg = (r.organization ?? "—").replace(/\|/g, "\\|");
    console.log(`| ${r.fullName} | ${r.email} | ${safeOrg} | ${r.magicLink} |`);
  }

  // CSV (mail-merge friendly)
  const csvHeader = "expertId,fullName,email,organization,magicLink,expiresAt";
  const csvRows = out.map((r) =>
    [
      csvEscape(r.expertId),
      csvEscape(r.fullName),
      csvEscape(r.email),
      csvEscape(r.organization ?? ""),
      csvEscape(r.magicLink),
      csvEscape(r.expiresAt),
    ].join(",")
  );
  writeFileSync(
    join(process.cwd(), "data", "_invitations.csv"),
    [csvHeader, ...csvRows].join("\n") + "\n"
  );

  // JSON (programmatic)
  writeFileSync(
    join(process.cwd(), "data", "_invitations.json"),
    JSON.stringify(out, null, 2) + "\n"
  );

  console.log(`\n✓ Wrote data/_invitations.csv and data/_invitations.json`);
  console.log("  Both are gitignored. Forward the CSV to whoever sends emails.");
}

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
