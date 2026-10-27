// Offer costing engine — a web port of the SARP waterproofing offer template's
// "Parametrat" assumptions and the per-line pricing formulas on each system tab.
//
// All figures here are in ALL (the catalogue's base currency). Currency
// conversion and VAT are handled by the offer itself (offer.currency /
// offer.exchangeRate / offer.vatRate), so they are deliberately NOT in params.
//
// Line pricing (material):
//   cost/unit U = supplierPrice P × (1 + waste)
//   sell/unit W = U × (1 + markup) × (1 + mobilization)
// Application (labour) line:
//   cost/unit = (dailyRate × teamSize + equipmentPerDay) / yieldM2PerDay
//   sell/unit = cost × (1 + markup) × (1 + mobilization)
// The caller multiplies by consumption (units/m²) and measured area, and
// converts ALL→offer currency.

export type OfferParams = {
  // Labour & productivity
  dailyRateAll: number; // ALL / worker / day      (Parametrat C6)
  teamSize: number; //                             (C7)
  yieldM2PerDay: number; // m² / team / day         (C8)
  // Material
  wastePct: number; // fraction, e.g. 0.1          (C11)
  fxBufferPct: number; // reference only            (C12)
  // Operational
  mobilizationPct: number; // over sell value       (C15)
  equipmentPerDayAll: number; // ALL / work day     (C16)
  // Reserves & risk (reference — not auto-added to the per-line price, matching the sheet)
  warrantyPct: number; //                           (C19)
  contingencyPct: number; //                        (C20)
  // Profit
  markupPct: number; //                             (C23)
  minMarkupPct: number; // suggested floor          (C29)
};

// Defaults straight from the template's Parametrat sheet.
export const DEFAULT_OFFER_PARAMS: OfferParams = {
  dailyRateAll: 7000,
  teamSize: 3,
  yieldM2PerDay: 60,
  wastePct: 0.1,
  fxBufferPct: 0.03,
  mobilizationPct: 0.02,
  equipmentPerDayAll: 2500,
  warrantyPct: 0.02,
  contingencyPct: 0.04,
  markupPct: 0.4,
  minMarkupPct: 0.09,
};

/** Coerce an unknown (e.g. a stored JSON blob) into a complete OfferParams. */
export function resolveOfferParams(value: unknown): OfferParams {
  const v = (value ?? {}) as Partial<OfferParams>;
  const n = (x: unknown, fallback: number) => (typeof x === "number" && Number.isFinite(x) ? x : fallback);
  return {
    dailyRateAll: n(v.dailyRateAll, DEFAULT_OFFER_PARAMS.dailyRateAll),
    teamSize: n(v.teamSize, DEFAULT_OFFER_PARAMS.teamSize),
    yieldM2PerDay: n(v.yieldM2PerDay, DEFAULT_OFFER_PARAMS.yieldM2PerDay),
    wastePct: n(v.wastePct, DEFAULT_OFFER_PARAMS.wastePct),
    fxBufferPct: n(v.fxBufferPct, DEFAULT_OFFER_PARAMS.fxBufferPct),
    mobilizationPct: n(v.mobilizationPct, DEFAULT_OFFER_PARAMS.mobilizationPct),
    equipmentPerDayAll: n(v.equipmentPerDayAll, DEFAULT_OFFER_PARAMS.equipmentPerDayAll),
    warrantyPct: n(v.warrantyPct, DEFAULT_OFFER_PARAMS.warrantyPct),
    contingencyPct: n(v.contingencyPct, DEFAULT_OFFER_PARAMS.contingencyPct),
    markupPct: n(v.markupPct, DEFAULT_OFFER_PARAMS.markupPct),
    minMarkupPct: n(v.minMarkupPct, DEFAULT_OFFER_PARAMS.minMarkupPct),
  };
}

export type LineKind = "MATERIAL" | "LABOUR" | "OTHER";

/** Labour cost per m² for an application line, from the productivity assumptions (ALL). */
export function labourCostPerUnit(params: OfferParams): number {
  if (params.yieldM2PerDay <= 0) return 0;
  return (params.dailyRateAll * params.teamSize + params.equipmentPerDayAll) / params.yieldM2PerDay;
}

export type UnitPricing = { costPerUnitAll: number; sellPerUnitAll: number; marginPct: number };

/**
 * Per-base-unit cost & selling price, in ALL. For MATERIAL pass the supplier
 * price; for LABOUR it is derived from the productivity params. Returns null
 * when there is nothing to price from (manual line with no supplier price).
 */
export function priceUnit(kind: LineKind, supplierPriceAll: number | null | undefined, params: OfferParams): UnitPricing | null {
  let costPerUnitAll: number;
  if (kind === "LABOUR") {
    costPerUnitAll = labourCostPerUnit(params);
  } else if (supplierPriceAll != null && Number.isFinite(supplierPriceAll)) {
    costPerUnitAll = supplierPriceAll * (1 + params.wastePct);
  } else {
    return null;
  }
  const sellPerUnitAll = costPerUnitAll * (1 + params.markupPct) * (1 + params.mobilizationPct);
  const marginPct = sellPerUnitAll > 0 ? (sellPerUnitAll - costPerUnitAll) / sellPerUnitAll : 0;
  return { costPerUnitAll, sellPerUnitAll, marginPct };
}

/** Convert an ALL figure into the offer's currency. */
export function allToOffer(valueAll: number, currency: string, exchangeRate: number): number {
  return currency === "ALL" || exchangeRate <= 0 ? valueAll : valueAll / exchangeRate;
}
