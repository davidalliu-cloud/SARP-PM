import { readFileSync } from "fs";
import { PrismaClient, ProjectStatus, UserRole } from "@prisma/client";

const prisma = new PrismaClient();
const inputPath = "prisma/local-export.json";

type JsonDate = string | Date;

function date(value: JsonDate) {
  return new Date(value);
}

type ExportedData = {
  users: Array<{
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    createdAt: JsonDate;
    updatedAt: JsonDate;
  }>;
  products: Array<{
    id: string;
    name: string;
    unit: string;
    defaultCostPerUnit: number;
    createdAt: JsonDate;
    updatedAt: JsonDate;
  }>;
  employees: Array<{
    id: string;
    name: string;
    role: string | null;
    defaultDailyWage: number;
    createdAt: JsonDate;
    updatedAt: JsonDate;
  }>;
  expenseTypes: Array<{
    id: string;
    name: string;
    defaultAmount: number;
    notes: string | null;
    createdAt: JsonDate;
    updatedAt: JsonDate;
  }>;
  projects: Array<{
    id: string;
    name: string;
    clientName: string | null;
    startDate: JsonDate;
    status: ProjectStatus;
    budgetAmount?: number;
    createdAt: JsonDate;
    updatedAt: JsonDate;
  }>;
  dailyRecords: Array<{
    id: string;
    projectId: string;
    date: JsonDate;
    notes: string | null;
    createdAt: JsonDate;
    updatedAt: JsonDate;
  }>;
  productUsageItems: Array<{
    id: string;
    dailyRecordId: string;
    productId: string;
    quantity: number;
    costPerUnit: number;
  }>;
  labourEntryItems: Array<{
    id: string;
    dailyRecordId: string;
    employeeId: string | null;
    employeeName: string | null;
    externalTeamName: string | null;
    ratePerSquareMeter: number | null;
    squareMeters: number | null;
    dailyWage: number;
  }>;
  expenseItems: Array<{
    id: string;
    dailyRecordId: string;
    expenseTypeId: string | null;
    category: string;
    description: string | null;
    amount: number;
  }>;
  invoices: Array<{
    id: string;
    projectId: string;
    invoiceDate: JsonDate;
    monthCovered: string;
    invoiceNo: string | null;
    amount: number;
    isPaid?: boolean;
    paidDate?: JsonDate | null;
    notes: string | null;
    createdAt: JsonDate;
    updatedAt: JsonDate;
  }>;
};

async function createManyInBatches<T>(
  label: string,
  rows: T[],
  createMany: (batch: T[]) => Promise<unknown>,
  batchSize = 100
) {
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    await createMany(batch);
    console.log(`Imported ${label}: ${Math.min(index + batch.length, rows.length)}/${rows.length}`);
  }
}

async function main() {
  if (process.env.MIGRATE_CONFIRM !== "copy-local-to-online") {
    throw new Error('Set MIGRATE_CONFIRM="copy-local-to-online" to confirm replacing online data.');
  }

  if (!process.env.DATABASE_URL?.startsWith("postgres")) {
    throw new Error("DATABASE_URL must be your online Postgres database URL.");
  }

  const data = JSON.parse(readFileSync(inputPath, "utf8")) as ExportedData;

  console.log("Clearing online database tables...");
  await prisma.session.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.expenseItem.deleteMany();
  await prisma.labourEntryItem.deleteMany();
  await prisma.productUsageItem.deleteMany();
  await prisma.dailyRecord.deleteMany();
  await prisma.expenseType.deleteMany();
  await prisma.project.deleteMany();
  await prisma.product.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();

  await createManyInBatches(
    "users",
    data.users.map((user) => ({
      ...user,
      createdAt: date(user.createdAt),
      updatedAt: date(user.updatedAt),
    })),
    (batch) => prisma.user.createMany({ data: batch })
  );

  await createManyInBatches(
    "products",
    data.products.map((product) => ({
      ...product,
      createdAt: date(product.createdAt),
      updatedAt: date(product.updatedAt),
    })),
    (batch) => prisma.product.createMany({ data: batch })
  );

  await createManyInBatches(
    "employees",
    data.employees.map((employee) => ({
      ...employee,
      createdAt: date(employee.createdAt),
      updatedAt: date(employee.updatedAt),
    })),
    (batch) => prisma.employee.createMany({ data: batch })
  );

  await createManyInBatches(
    "expense types",
    data.expenseTypes.map((expenseType) => ({
      ...expenseType,
      createdAt: date(expenseType.createdAt),
      updatedAt: date(expenseType.updatedAt),
    })),
    (batch) => prisma.expenseType.createMany({ data: batch })
  );

  await createManyInBatches(
    "projects",
    data.projects.map((project) => ({
      ...project,
      budgetAmount: project.budgetAmount ?? 0,
      startDate: date(project.startDate),
      createdAt: date(project.createdAt),
      updatedAt: date(project.updatedAt),
    })),
    (batch) => prisma.project.createMany({ data: batch })
  );

  await createManyInBatches(
    "daily records",
    data.dailyRecords.map((dailyRecord) => ({
      ...dailyRecord,
      date: date(dailyRecord.date),
      createdAt: date(dailyRecord.createdAt),
      updatedAt: date(dailyRecord.updatedAt),
    })),
    (batch) => prisma.dailyRecord.createMany({ data: batch })
  );

  await createManyInBatches("product usage items", data.productUsageItems, (batch) => prisma.productUsageItem.createMany({ data: batch }));
  await createManyInBatches("labour items", data.labourEntryItems, (batch) => prisma.labourEntryItem.createMany({ data: batch }));
  await createManyInBatches("expense items", data.expenseItems, (batch) => prisma.expenseItem.createMany({ data: batch }));

  await createManyInBatches(
    "invoices",
    data.invoices.map((invoice) => ({
      ...invoice,
      invoiceDate: date(invoice.invoiceDate),
      isPaid: invoice.isPaid ?? false,
      paidDate: invoice.paidDate ? date(invoice.paidDate) : null,
      createdAt: date(invoice.createdAt),
      updatedAt: date(invoice.updatedAt),
    })),
    (batch) => prisma.invoice.createMany({ data: batch })
  );

  console.log(`Imported local data into online database: ${data.projects.length} projects, ${data.products.length} products, ${data.dailyRecords.length} daily records.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
