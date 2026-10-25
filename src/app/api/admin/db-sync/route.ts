import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createOfferTables } from "@/lib/offer-setup";

// One-off, idempotent, ADDITIVE schema sync applied through the app's own
// (working) database connection. Vercel builds can't reach Prisma Postgres
// directly, so new columns/tables are applied from here instead of db push.
// Admin-only and safe to run repeatedly (IF NOT EXISTS / existence checks).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const applied: string[] = [];
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
    return NextResponse.json({ ok: true, applied });
  } catch (error) {
    return NextResponse.json({ ok: false, applied, error: String(error) }, { status: 500 });
  }
}
