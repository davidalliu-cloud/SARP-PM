import { randomBytes, scryptSync } from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const email = process.env.RESET_EMAIL?.trim().toLowerCase();
  const password = process.env.RESET_PASSWORD;

  if (!email || !password) {
    throw new Error("Set RESET_EMAIL and RESET_PASSWORD before running this command.");
  }

  if (password.length < 8) {
    throw new Error("RESET_PASSWORD must be at least 8 characters.");
  }

  await prisma.user.update({
    where: { email },
    data: {
      passwordHash: hashPassword(password),
      sessions: { deleteMany: {} },
    },
  });

  console.log(`Password reset for ${email}. Existing sessions were signed out.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
