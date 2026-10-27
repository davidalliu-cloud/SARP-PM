import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createOfferTables } from "@/lib/offer-setup";

// One-off, idempotent, ADDITIVE schema sync applied through the app's own
// (working) database connection. Vercel builds can't reach Prisma Postgres
// directly, so new columns/tables are applied from here instead of db push.
// Admin-only and safe to run repeatedly (IF NOT EXISTS / existence checks).
//
// It now also runs the queries that back the authenticated pages and reports
// the exact error for any that fail, so a post-login crash can be diagnosed
// without server log access.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const applied: string[] = [];
  const checks: Record<string, string> = {};

  // 1) Additive schema fixes (idempotent).
  try {
    const statements = [
      `ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "sourceAmount" DOUBLE PRECISION`,
      `ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "sourceCurrency" TEXT`,
      `ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "vatRate" DOUBLE PRECISION`,
    ];
    for (const sql of statements) {
      await prisma.$executeRawUnsafe(sql);
      applied.push(sql);
    }
    await createOfferTables();
    applied.push("offer tables ensured");
  } catch (error) {
    return NextResponse.json({ ok: false, stage: "apply", applied, error: String(error) }, { status: 500 });
  }

  // 2) Health checks — run the queries the authenticated pages depend on and
  //    capture the exact error for any that fail.
  const run = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      checks[name] = "ok";
    } catch (error) {
      checks[name] = String(error);
    }
  };

  await run("appShell.projects", () =>
    prisma.project.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        budgetAmount: true,
        estimatedContractValue: true,
        invoices: true,
        dailyRecords: { include: { productItems: true, labourItems: true, expenseItems: true } },
      },
      take: 1,
    }),
  );
  await run("dashboard.projects", () =>
    prisma.project.findMany({
      include: {
        dailyRecords: { include: { productItems: { include: { product: true } }, labourItems: true, expenseItems: true } },
        invoices: true,
      },
      take: 1,
    }),
  );
  await run("offers.count", () => prisma.offer.count());
  await run("offers.findMany", () =>
    prisma.offer.findMany({ include: { sections: { include: { items: true } }, createdBy: { select: { name: true } } }, take: 1 }),
  );
  await run("invoices.findMany", () => prisma.invoice.findMany({ include: { project: true }, take: 1 }));

  const allOk = Object.values(checks).every((v) => v === "ok");
  return NextResponse.json({ ok: allOk, applied, checks });
}
