import { randomBytes, scryptSync } from "crypto";
import { PrismaClient, ProjectStatus, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.expenseItem.deleteMany();
  await prisma.expenseType.deleteMany();
  await prisma.labourEntryItem.deleteMany();
  await prisma.productUsageItem.deleteMany();
  await prisma.dailyRecord.deleteMany();
  await prisma.project.deleteMany();
  await prisma.product.deleteMany();
  await prisma.employee.deleteMany();

  const [membrane, primer, sealant, mesh] = await Promise.all([
    prisma.product.create({ data: { name: "Torch-on membrane", unit: "roll", defaultCostPerUnit: 78 } }),
    prisma.product.create({ data: { name: "Bitumen primer", unit: "tin", defaultCostPerUnit: 42 } }),
    prisma.product.create({ data: { name: "PU sealant", unit: "tube", defaultCostPerUnit: 6.5 } }),
    prisma.product.create({ data: { name: "Reinforcement mesh", unit: "sqm", defaultCostPerUnit: 3.2 } }),
  ]);

  await prisma.user.create({
    data: {
      name: process.env.ADMIN_NAME || "SARP Admin",
      email: (process.env.ADMIN_EMAIL || "admin@sarp.local").toLowerCase(),
      passwordHash: hashPassword(process.env.ADMIN_PASSWORD || "ChangeMe123!"),
      role: UserRole.ADMIN,
    },
  });

  const [foreman, installer, labourer] = await Promise.all([
    prisma.employee.create({ data: { name: "Samir Haddad", role: "Foreman", defaultDailyWage: 210 } }),
    prisma.employee.create({ data: { name: "Lina Mansour", role: "Waterproofing Installer", defaultDailyWage: 180 } }),
    prisma.employee.create({ data: { name: "Marco Silva", role: "Labourer", defaultDailyWage: 145 } }),
  ]);

  const [foodAllowance, extraHours, tools] = await Promise.all([
    prisma.expenseType.create({ data: { name: "Food allowance", defaultAmount: 25, notes: "Meals or daily food allowance for site crew." } }),
    prisma.expenseType.create({ data: { name: "Extra hours", defaultAmount: 45, notes: "Additional labour hours outside the normal day rate." } }),
    prisma.expenseType.create({ data: { name: "Tools", defaultAmount: 0, notes: "Small tools or consumables bought during a project." } }),
    prisma.expenseType.create({ data: { name: "Transport", defaultAmount: 0, notes: "Parking, fuel, delivery, and local transport expenses." } }),
    prisma.expenseType.create({ data: { name: "Other", defaultAmount: 0, notes: "Miscellaneous project expense." } }),
  ]);

  const project = await prisma.project.create({
    data: {
      name: "Riverside Pump Station",
      clientName: "AquaBuild GmbH",
      startDate: new Date("2026-04-01"),
      status: ProjectStatus.ACTIVE,
    },
  });

  await prisma.dailyRecord.create({
    data: {
      projectId: project.id,
      date: new Date("2026-04-08"),
      notes: "Roof slab preparation and first membrane layer.",
      productItems: {
        create: [
          { productId: membrane.id, quantity: 12, costPerUnit: 78 },
          { productId: primer.id, quantity: 4, costPerUnit: 42 },
        ],
      },
      labourItems: {
        create: [
          { employeeId: foreman.id, dailyWage: 210 },
          { employeeId: installer.id, dailyWage: 180 },
          { employeeId: labourer.id, dailyWage: 145 },
        ],
      },
      expenseItems: {
        create: [
          { category: "Food allowance", expenseTypeId: foodAllowance.id, description: "Crew lunch allowance", amount: 55 },
          { category: "Tools", expenseTypeId: tools.id, description: "Gas torch nozzle replacement", amount: 38 },
        ],
      },
    },
  });

  await prisma.dailyRecord.create({
    data: {
      projectId: project.id,
      date: new Date("2026-04-15"),
      notes: "Detailing around penetrations and upstands.",
      productItems: {
        create: [
          { productId: sealant.id, quantity: 38, costPerUnit: 6.5 },
          { productId: mesh.id, quantity: 65, costPerUnit: 3.2 },
        ],
      },
      labourItems: {
        create: [
          { employeeId: installer.id, dailyWage: 180 },
          { employeeId: labourer.id, dailyWage: 145 },
        ],
      },
      expenseItems: {
        create: [
          { category: "Extra hours", expenseTypeId: extraHours.id, description: "Late finish for penetration details", amount: 90 },
        ],
      },
    },
  });

  await prisma.invoice.create({
    data: {
      projectId: project.id,
      invoiceDate: new Date("2026-04-25"),
      monthCovered: "2026-04",
      invoiceNo: "SARP-2026-041",
      amount: 4200,
      notes: "April progress invoice.",
    },
  });

  await prisma.project.create({
    data: {
      name: "North Basin Expansion",
      clientName: "Municipal Water Authority",
      startDate: new Date("2026-03-18"),
      status: ProjectStatus.ON_HOLD,
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
