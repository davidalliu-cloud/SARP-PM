import type { PrismaClient } from "@prisma/client";
import prices from "../data/offer-prices.json";

// Manual supplier-price overrides for catalogue products that had no price (or a
// corrected one), matched by name. Append new rows here as David supplies prices.
// supplierPriceAll is per base unit in ALL; priceEur the same in EUR (reference).
export type PriceEntry = { name: string; supplierPriceAll: number; priceEur?: number | null };

export const offerPrices = prices as PriceEntry[];

/** Apply the price overrides to Product, matched by name. Idempotent. */
export async function importOfferPrices(prisma: PrismaClient) {
  const existing = await prisma.product.findMany({ select: { id: true, name: true } });
  const idByName = new Map(existing.map((p) => [p.name, p.id]));
  let updated = 0;
  const missing: string[] = [];
  for (const entry of offerPrices) {
    const id = idByName.get(entry.name);
    if (!id) {
      missing.push(entry.name);
      continue;
    }
    await prisma.product.update({
      where: { id },
      data: { supplierPriceAll: entry.supplierPriceAll, priceEur: entry.priceEur ?? null },
    });
    updated += 1;
  }
  return { total: offerPrices.length, updated, missing };
}
