// Offer costing engine — a web port of the SARP waterproofing offer template's
// "Parametrat" assumptions and the per-line pricing formulas on each system tab.
//
// Everything is computed directly in the OFFER's currency:
//  • A material's cost is its real supplier price. Products are priced in EUR
//    (priceEur); on a EUR offer that EUR figure is used as-is (no exchange rate
//    needed), and on a Lek offer it is converted with the offer's exchange rate.
//  • Labour (day-rate, equipment) is entered in the offer's currency, so a EUR
//    offer needs no exchange rate at all.
//
// Line pricing (material):
//   cost/unit U = supplierPrice (offer currency) × (1 + mobilization)
//                 (waste lives in the m² consumption, so it is NOT re-applied here)
//   sell/unit W = U / (1 − targetMargin)
// Application (labour) line:
//   cost/unit = (dailyRate × teamSize + equipmentPerDay) / yieldM2PerDay × (1 + mobilization)
//   sell/unit = cost / (1 − targetMargin)
// The price is driven by the PROFIT MARGIN (profit as a share of the selling
// price), not a cost markup: margin = (sell − cost) / sell, so sell = cost /
// (1 − margin). Mobilization is folded into the cost base, so the realised
// margin equals the target exactly. The caller multiplies by consumption
// (units/m²) and measured area.

export type OfferParams = {
  // Labour & productivity (day-rate / equipment are in the OFFER currency)
  dailyRateAll: number; //  / worker / day           (Parametrat C6)
  teamSize: number; //                               (C7)
  yieldM2PerDay: number; // m² / team / day           (C8)
  // Operational
  mobilizationPct: number; // over the cost base      (C15)
  equipmentPerDayAll: number; //  / work day          (C16)
  // Reserves & risk — loaded onto the cost base (0 → no effect).
  warrantyPct: number; //                             (C19)
  contingencyPct: number; //                          (C20)
  // Profit — margin on the selling price (profit ÷ price), NOT a markup on cost.
  targetMarginPct: number; // fraction, e.g. 0.30     (C23)
  minMarginPct: number; // suggested floor            (C29)
};

// Defaults from the template's Parametrat sheet (day-rate shown here in Lek;
// blankOfferValues scales it down for a EUR offer).
export const DEFAULT_OFFER_PARAMS: OfferParams = {
  dailyRateAll: 7000,
  teamSize: 3,
  yieldM2PerDay: 60,
  mobilizationPct: 0.02,
  equipmentPerDayAll: 2500,
  // Reserves default to 0 — opt in per offer when you want a warranty /
  // contingency buffer (they are loaded onto the cost when set).
  warrantyPct: 0,
  contingencyPct: 0,
  targetMarginPct: 0.3,
  minMarginPct: 0.09,
};

/** Convert a legacy cost-markup fraction into the equivalent margin on price. */
const markupToMargin = (markup: number) => (markup > -1 ? markup / (1 + markup) : 0);

/** Coerce an unknown (e.g. a stored JSON blob) into a complete OfferParams. */
export function resolveOfferParams(value: unknown): OfferParams {
  const v = (value ?? {}) as Partial<OfferParams> & { markupPct?: number; minMarkupPct?: number };
  const n = (x: unknown, fallback: number) => (typeof x === "number" && Number.isFinite(x) ? x : fallback);
  // Offers saved before the margin switch stored markupPct/minMarkupPct; map
  // them onto the equivalent margin so their prices stay consistent.
  const legacyMargin = typeof v.markupPct === "number" && Number.isFinite(v.markupPct) ? markupToMargin(v.markupPct) : undefined;
  const legacyMinMargin =
    typeof v.minMarkupPct === "number" && Number.isFinite(v.minMarkupPct) ? markupToMargin(v.minMarkupPct) : undefined;
  return {
    dailyRateAll: n(v.dailyRateAll, DEFAULT_OFFER_PARAMS.dailyRateAll),
    teamSize: n(v.teamSize, DEFAULT_OFFER_PARAMS.teamSize),
    yieldM2PerDay: n(v.yieldM2PerDay, DEFAULT_OFFER_PARAMS.yieldM2PerDay),
    mobilizationPct: n(v.mobilizationPct, DEFAULT_OFFER_PARAMS.mobilizationPct),
    equipmentPerDayAll: n(v.equipmentPerDayAll, DEFAULT_OFFER_PARAMS.equipmentPerDayAll),
    warrantyPct: n(v.warrantyPct, DEFAULT_OFFER_PARAMS.warrantyPct),
    contingencyPct: n(v.contingencyPct, DEFAULT_OFFER_PARAMS.contingencyPct),
    targetMarginPct: n(v.targetMarginPct, legacyMargin ?? DEFAULT_OFFER_PARAMS.targetMarginPct),
    minMarginPct: n(v.minMarginPct, legacyMinMargin ?? DEFAULT_OFFER_PARAMS.minMarginPct),
  };
}

export type LineKind = "MATERIAL" | "LABOUR" | "OTHER";
export type OfferCurrency = "EUR" | "ALL";

/** Labour cost per m² for an application line, in the offer currency. */
export function labourCostPerUnit(params: OfferParams): number {
  if (params.yieldM2PerDay <= 0) return 0;
  return (params.dailyRateAll * params.teamSize + params.equipmentPerDayAll) / params.yieldM2PerDay;
}

export type MaterialPrice = { priceEur?: number | null; supplierPriceAll?: number | null };

/** A material's supplier cost per base unit, in the offer currency. */
export function materialUnitCost(material: MaterialPrice | null | undefined, currency: OfferCurrency, exchangeRate: number): number | null {
  if (!material) return null;
  const eur = material.priceEur;
  const all = material.supplierPriceAll;
  // A supplier cost is only real when it is a positive number. Treat 0, null or
  // NaN as "no price on file" (many catalogue rows carry 0/null until a price is
  // set) so the offer never silently shows a €0 line — the editor then prompts
  // for a manual cost instead of pretending the product is free.
  const pos = (n: number | null | undefined): n is number => n != null && Number.isFinite(n) && n > 0;
  if (currency === "ALL") {
    // Lek offer: convert the EUR supplier price at the offer's rate; fall back
    // to a Lek-native price if that is all the product has.
    if (pos(eur)) return eur * exchangeRate;
    if (pos(all)) return all;
    return null;
  }
  // EUR offer: use the EUR supplier price directly — no exchange rate.
  if (pos(eur)) return eur;
  if (pos(all) && exchangeRate > 0) return all / exchangeRate;
  return null;
}

export type UnitPricing = { costPerUnit: number; sellPerUnit: number; marginPct: number };

/**
 * Per-base-unit cost & selling price, in the OFFER currency. For MATERIAL pass
 * the product's price; for LABOUR it is derived from the productivity params.
 * Returns null when there is nothing to price from.
 */
export function priceUnit(
  kind: LineKind,
  material: MaterialPrice | null | undefined,
  params: OfferParams,
  currency: OfferCurrency,
  exchangeRate: number,
): UnitPricing | null {
  let baseCost: number;
  if (kind === "LABOUR") {
    baseCost = labourCostPerUnit(params);
  } else {
    const resolved = materialUnitCost(material, currency, exchangeRate);
    if (resolved == null) return null;
    baseCost = resolved;
  }
  // Operational + risk loadings on the cost base (each 0 → no effect):
  //  mobilization (site setup), warranty reserve, contingency reserve.
  const costPerUnit =
    baseCost * (1 + params.mobilizationPct) * (1 + params.warrantyPct) * (1 + params.contingencyPct);
  // Margin-driven selling price: sell = cost / (1 − margin). Clamp the margin so
  // the divisor can never reach zero or go negative.
  const margin = Math.min(Math.max(params.targetMarginPct, 0), 0.95);
  const sellPerUnit = costPerUnit / (1 - margin);
  const marginPct = sellPerUnit > 0 ? (sellPerUnit - costPerUnit) / sellPerUnit : 0;
  return { costPerUnit, sellPerUnit, marginPct };
}
