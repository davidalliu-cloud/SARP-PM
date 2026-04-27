import { mkdirSync, writeFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const outputPath = "prisma/local-export.json";

async function main() {
  mkdirSync("prisma", { recursive: true });

  const data = {
    users: await prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    products: await prisma.product.findMany({ orderBy: { createdAt: "asc" } }),
    employees: await prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    expenseTypes: await prisma.expenseType.findMany({ orderBy: { createdAt: "asc" } }),
    projects: await prisma.project.findMany({ orderBy: { createdAt: "asc" } }),
    dailyRecords: await prisma.dailyRecord.findMany({ orderBy: { createdAt: "asc" } }),
    productUsageItems: await prisma.productUsageItem.findMany(),
    labourEntryItems: await prisma.labourEntryItem.findMany(),
    expenseItems: await prisma.expenseItem.findMany(),
    invoices: await prisma.invoice.findMany({ orderBy: { createdAt: "asc" } }),
  };

  writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`Exported local SQLite data to ${outputPath}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
