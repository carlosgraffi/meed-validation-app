/**
 * Generate a fresh magic-link URL for the admin email. Print to stdout.
 *
 * Usage:
 *   npx tsx scripts/admin-link.ts
 *   npx tsx scripts/admin-link.ts http://localhost:3000
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!adminEmail) {
    console.error("ADMIN_EMAIL is not set in .env");
    process.exit(1);
  }
  const baseUrl = process.argv[2] ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const admin = await prisma.expert.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    console.error(
      `Admin user not found for ${adminEmail}. Run "npm run seed" first.`
    );
    process.exit(1);
  }

  const ttlMin = parseInt(process.env.MAGIC_LINK_TTL_MIN ?? "10080", 10);
  const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000);
  const token = randomBytes(32).toString("base64url");

  await prisma.magicToken.create({
    data: {
      token,
      expertId: admin.id,
      expiresAt,
    },
  });

  console.log("");
  console.log("Admin magic link:");
  console.log(`  ${baseUrl}/auth/magic/${token}`);
  console.log(`  (expires ${expiresAt.toISOString()})`);
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
