import type { PrismaClient } from "@prisma/client";
import catalogue from "../data/offer-catalogue.json";

// The waterproofing product catalogue extracted from the SARP offer template
// ("Katalogu i Produkteve"). Each entry carries the Mapei-TDS consumption per m²
// and the supplier base-unit price used by the offer costing engine.
export type CatalogueEntry = {
  name: string;
  workItem: string | null;
  consumptionPerM2: number | null;
  consumptionBasis: string | null;
  baseUnit: string | null;
  supplierPriceAll: number | null;
  priceEur: number | null;
};

export const offerCatalogue = catalogue as CatalogueEntry[];

/**
 * Upsert the catalogue into Product, matched by name. Existing products get only
 * the offer-costing fields added (daily-record unit/cost are left untouched);
 * products new to SARP-PM are created with the catalogue's base unit and price.
 * Idempotent — safe to re-run after the catalogue changes.
 */
export async function importOfferCatalogue(prisma: PrismaClient) {
  let created = 0;
  let updated = 0;
  for (const entry of offerCatalogue) {
    const offerFields = {
      consumptionPerM2: entry.consumptionPerM2,
      consumptionBasis: entry.consumptionBasis,
      workItem: entry.workItem,
      baseUnit: entry.baseUnit,
      supplierPriceAll: entry.supplierPriceAll,
      priceEur: entry.priceEur,
    };
    const existing = await prisma.product.findFirst({ where: { name: entry.name }, select: { id: true } });
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data: offerFields });
      updated += 1;
    } else {
      await prisma.product.create({
        data: {
          name: entry.name,
          unit: entry.baseUnit ?? "kg",
          defaultCostPerUnit: entry.supplierPriceAll ?? 0,
          ...offerFields,
        },
      });
      created += 1;
    }
  }
  return { total: offerCatalogue.length, created, updated };
}
