/**
 * Generate fresh magic-link URLs for the first N experts (default 3).
 * Prints to stdout. Use for local demo / smoke testing.
 *
 * Usage:
 *   npx tsx scripts/expert-links.ts                      # 3 links, NEXTAUTH_URL host
 *   npx tsx scripts/expert-links.ts 5                    # 5 links
 *   npx tsx scripts/expert-links.ts 3 http://localhost:3002
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  const n = parseInt(process.argv[2] ?? "3", 10);
  const baseUrl =
    process.argv[3] ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  // First N non-admin experts from the fixture list, ordered by id.
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const experts = await prisma.expert.findMany({
    where: adminEmail ? { email: { not: adminEmail } } : undefined,
    orderBy: { id: "asc" },
    take: n,
  });

  if (experts.length === 0) {
    console.error("No experts in DB. Run `npm run seed` first.");
    process.exit(1);
  }

  const ttlMin = parseInt(process.env.MAGIC_LINK_TTL_MIN ?? "10080", 10);
  const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000);

  console.log("");
  console.log("================ EXPERT MAGIC LINKS ================");
  for (const e of experts) {
    const token = randomBytes(32).toString("base64url");
    await prisma.magicToken.create({
      data: { token, expertId: e.id, expiresAt },
    });
    console.log(`\n  ${e.fullName}  (${e.email})`);
    console.log(`  ${baseUrl}/auth/magic/${token}`);
  }
  console.log(`\n  All links expire ${expiresAt.toISOString()}`);
  console.log("=====================================================");
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
