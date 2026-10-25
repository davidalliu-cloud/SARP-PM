import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createOfferTables } from "@/lib/offer-setup";

// One-off, idempotent, ADDITIVE schema sync applied through the app's own
// (working) database connection. Vercel builds can't reach Prisma Postgres
// directly, so new columns/tables are applied from here instead of db push.
// Admin-only and safe to run repeatedly (IF NOT EXISTS / existence checks).
// Temporary one-time repair key: lets the fix run when no admin session is
// available (the login redirect lands on the crashing shell). Remove after use.
const REPAIR_KEY = "k7Qm2Xp9Lr4Vt8Zs6Nd";

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  const user = await getCurrentUser();
  const authorized = key === REPAIR_KEY || user?.role === "ADMIN";
  if (!authorized) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

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
