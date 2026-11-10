import { prisma } from "@/lib/prisma";

// Additive, idempotent schema statements (ADD COLUMN IF NOT EXISTS). Production
// uses Prisma Postgres, which the Vercel build cannot reach (see vercel-build),
// so new columns are applied at runtime instead of via `prisma db push`.
//
// These run automatically when a server instance boots (the Next.js startup
// hook in src/instrumentation.ts calls ensureSchema, before any request is
// served), so a deploy that introduces a new column heals the database itself —
// a newly-declared column can no longer take a page down in the window before
// an admin opens /api/admin/db-sync. Every statement is idempotent, so running
// them on each cold start is safe and cheap. db-sync remains as a manual sync
// that also runs health checks.
export const SCHEMA_STATEMENTS: string[] = [
  `ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "sourceAmount" DOUBLE PRECISION`,
  `ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "sourceCurrency" TEXT`,
  `ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "vatRate" DOUBLE PRECISION`,
  // Offer costing engine — product consumption/TDS + supplier price, and per-offer params.
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "consumptionPerM2" DOUBLE PRECISION`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "consumptionBasis" TEXT`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "workItem" TEXT`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "baseUnit" TEXT`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "supplierPriceAll" DOUBLE PRECISION`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "priceEur" DOUBLE PRECISION`,
  `ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "params" JSONB`,
  // Offer technical descriptions (from Mapei/Polyglass TDS).
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "techDescription" TEXT`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "techSource" TEXT`,
  `ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "techDescription" TEXT`,
  // Mapei labour time (man-hours/m²) for the Rendimenti guidance.
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "labourManHoursPerM2" DOUBLE PRECISION`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "labourWorkers" INTEGER`,
  // Manual price override on an offer line.
  `ALTER TABLE "OfferItem" ADD COLUMN IF NOT EXISTS "manualPrice" BOOLEAN NOT NULL DEFAULT false`,
  // Labour line cost mode: fixed (subcontractor) cost with engine margin vs day-rate.
  `ALTER TABLE "OfferItem" ADD COLUMN IF NOT EXISTS "fixedCost" BOOLEAN NOT NULL DEFAULT false`,
];

/** Apply every additive column statement through the runtime connection. Raw
 *  SQL, so it bypasses the query middleware (no recursion). Returns the list. */
export async function applySchemaStatements(): Promise<string[]> {
  const applied: string[] = [];
  for (const sql of SCHEMA_STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    applied.push(sql);
  }
  return applied;
}

// Run once per process. A failure clears the cache so the next query retries
// rather than caching a rejected promise forever.
let ran: Promise<void> | null = null;
export function ensureSchema(): Promise<void> {
  if (!ran) {
    ran = applySchemaStatements()
      .then(() => undefined)
      .catch((error) => {
        ran = null;
        throw error;
      });
  }
  return ran;
}
