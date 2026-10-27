// Offer costing engine — a web port of the SARP waterproofing offer template's
// "Parametrat" assumptions and the per-line pricing formulas on each system tab.
//
// Line pricing (material):
//   cost/unit   U = supplierPrice P × (1 + waste)
//   sell/unit   W = U × (1 + markup) × (1 + mobilization)
//   value/m²    = consumption F × W      (then converted to the offer currency)
// Application (labour) line:
//   labour/unit = (dailyRate × teamSize + equipmentPerDay) / yieldM2PerDay
//   U = labour/unit, W = U × (1 + markup) × (1 + mobilization), consumption = 1
// All base figures are in ALL; if the offer currency is EUR, divide by eurToAll.

export type OfferParams = {
  // Labour & productivity
  dailyRateAll: number; // ALL / worker / day       (Parametrat C6)
  teamSize: number; //                              (C7)
  yieldM2PerDay: number; // m² / team / day          (C8)
  // Material
  wastePct: number; // fraction, e.g. 0.1           (C11)
  fxBufferPct: number; // reference only             (C12)
  // Operational
  mobilizationPct: number; // over sell value        (C15)
  equipmentPerDayAll: number; // ALL / work day      (C16)
  // Reserves & risk (reference — not auto-added to the per-line price, matching the sheet)
  warrantyPct: number; //                            (C19)
  contingencyPct: number; //                         (C20)
  // Profit
  markupPct: number; //                              (C23)
  vatPct: number; //                                 (C24)
  minMarkupPct: number; // suggested floor           (C29)
  // Currency
  eurToAll: number; // EUR → ALL rate                (C33)
  offerCurrency: "ALL" | "EUR"; //                   (C36)
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
  vatPct: 0.2,
  minMarkupPct: 0.09,
  eurToAll: 100,
  offerCurrency: "ALL",
};

export type LineKind = "MATERIAL" | "LABOUR";

export type LineCostInput = {
  kind: LineKind;
  /** Supplier price per base unit, in ALL (Product.supplierPriceAll). Ignored for LABOUR. */
  supplierPriceAll: number | null | undefined;
  /** Consumption: base units per m² (Product.consumptionPerM2). Defaults to 1. */
  consumptionPerM2: number | null | undefined;
  /** Measured area in m² for this line. */
  areaM2: number;
};

export type LinePricing = {
  consumption: number; // base units / m²
  costPerUnitAll: number; // U — total cost per base unit, ALL
  sellPerUnitAll: number; // W — selling price per base unit, ALL
  sellPerUnit: number; // W in the offer currency
  valuePerM2: number; // consumption × sellPerUnit (offer currency)
  lineTotal: number; // valuePerM2 × areaM2 (offer currency)
  lineCost: number; // consumption × U × areaM2 (ALL) — internal
  marginPct: number; // (sell − cost) / sell
};

const toOfferCurrency = (valueAll: number, params: OfferParams) =>
  params.offerCurrency === "EUR" ? valueAll / params.eurToAll : valueAll;

/** Labour cost per m² for an application line, from the productivity assumptions. */
export function labourCostPerUnit(params: OfferParams): number {
  if (params.yieldM2PerDay <= 0) return 0;
  return (params.dailyRateAll * params.teamSize + params.equipmentPerDayAll) / params.yieldM2PerDay;
}

export function computeLinePricing(input: LineCostInput, params: OfferParams): LinePricing {
  const consumption = input.consumptionPerM2 ?? 1;
  const costPerUnitAll =
    input.kind === "LABOUR"
      ? labourCostPerUnit(params)
      : (input.supplierPriceAll ?? 0) * (1 + params.wastePct);
  const sellPerUnitAll = costPerUnitAll * (1 + params.markupPct) * (1 + params.mobilizationPct);
  const sellPerUnit = toOfferCurrency(sellPerUnitAll, params);
  const valuePerM2 = consumption * sellPerUnit;
  const lineTotal = valuePerM2 * input.areaM2;
  const lineCost = consumption * costPerUnitAll * input.areaM2; // ALL
  const marginPct = sellPerUnitAll > 0 ? (sellPerUnitAll - costPerUnitAll) / sellPerUnitAll : 0;
  return { consumption, costPerUnitAll, sellPerUnitAll, sellPerUnit, valuePerM2, lineTotal, lineCost, marginPct };
}
