import type { PrismaClient } from "@prisma/client";
import catalogue from "../data/offer-catalogue.json";
import { importOfferPrices } from "@/lib/offer-prices";

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

export type ImportResult = {
  total: number;
  start: number;
  processed: number;
  created: number;
  updated: number;
  /** True on the final pass, when the price overrides were re-applied. */
  pricesReapplied?: boolean;
  /** Index to resume from, or null when the whole catalogue is done. */
  nextStart: number | null;
};

/**
 * Upsert the catalogue into Product, matched by name. Existing products get only
 * the offer-costing fields added (daily-record unit/cost are left untouched);
 * products new to SARP-PM are created with the catalogue's base unit and price.
 * Idempotent — safe to re-run; `start`/`count` let a large import run in
 * resumable chunks so a single request never exceeds the serverless time limit.
 */
export async function importOfferCatalogue(
  prisma: PrismaClient,
  opts: { start?: number; count?: number } = {},
): Promise<ImportResult> {
  const start = Math.max(0, Math.trunc(opts.start ?? 0));
  const count = Math.max(1, Math.trunc(opts.count ?? offerCatalogue.length));
  const slice = offerCatalogue.slice(start, start + count);

  // One read for the whole table, then write per entry — no per-row lookups.
  const existing = await prisma.product.findMany({ select: { id: true, name: true } });
  const idByName = new Map(existing.map((p) => [p.name, p.id]));

  let created = 0;
  let updated = 0;
  for (const entry of slice) {
    const offerFields = {
      consumptionPerM2: entry.consumptionPerM2,
      consumptionBasis: entry.consumptionBasis,
      workItem: entry.workItem,
      baseUnit: entry.baseUnit,
      supplierPriceAll: entry.supplierPriceAll,
      priceEur: entry.priceEur,
    };
    const id = idByName.get(entry.name);
    if (id) {
      await prisma.product.update({ where: { id }, data: offerFields });
      updated += 1;
    } else {
      const made = await prisma.product.create({
        data: { name: entry.name, unit: entry.baseUnit ?? "kg", defaultCostPerUnit: entry.supplierPriceAll ?? 0, ...offerFields },
      });
      idByName.set(entry.name, made.id);
      created += 1;
    }
  }

  const end = start + slice.length;
  // The catalogue carries supplierPriceAll for each product, so importing it
  // overwrites the manual price overrides (offer-prices.json). Re-apply those
  // overrides once the catalogue pass finishes, so a catalogue re-import can no
  // longer wipe a hand-set supplier price (e.g. Primer SN, Purtop Easy White).
  const done = end >= offerCatalogue.length;
  if (done) await importOfferPrices(prisma);

  return {
    total: offerCatalogue.length,
    start,
    processed: slice.length,
    created,
    updated,
    pricesReapplied: done,
    nextStart: done ? null : end,
  };
}
