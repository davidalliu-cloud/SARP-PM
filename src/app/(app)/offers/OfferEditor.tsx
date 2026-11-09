"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/components/LanguageProvider";
import { ITEM_UNITS, offerMoney, offerTotals, sectionTotals } from "@/lib/offer-calc";
import {
  allToOffer,
  DEFAULT_OFFER_PARAMS,
  priceUnit,
  type LineKind,
  type OfferParams,
} from "@/lib/offer-costing";
import { LABOUR_CATEGORIES, labourCategoryForDescription } from "@/lib/labour-categories";

type ItemRow = {
  key: string;
  kind: string;
  description: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  manualPrice: boolean;
};

type SectionRow = {
  key: string;
  title: string;
  zone: string;
  description: string;
  areaM2: number | null;
  isOption: boolean;
  items: ItemRow[];
};

export type OfferEditorValues = {
  id?: string;
  type: "WORKS" | "PRODUCTS";
  clientName: string;
  projectName: string;
  siteAddress: string;
  issueDate: string;
  validUntil: string;
  currency: "EUR" | "ALL";
  exchangeRate: number;
  vatRate: number;
  discountPct: number;
  params: OfferParams;
  paymentTerms: string;
  executionTerms: string;
  warrantyTerms: string;
  exclusions: string;
  internalNotes: string;
  techDescription: string;
  sections: (Omit<SectionRow, "key" | "items"> & { items: Omit<ItemRow, "key">[] })[];
};

type ProductOption = {
  name: string;
  unit: string;
  defaultCostPerUnit: number;
  baseUnit: string | null;
  consumptionPerM2: number | null;
  consumptionBasis: string | null;
  supplierPriceAll: number | null;
  workItem: string | null;
  techDescription: string | null;
  labourManHoursPerM2: number | null;
  labourWorkers: number | null;
};

let keySeed = 0;
const newKey = () => `k${Date.now()}-${keySeed++}`;
const round2 = (value: number) => Math.round(value * 100) / 100;

function blankItem(kind = "MATERIAL", unit = "kg"): ItemRow {
  return { key: newKey(), kind, description: "", productName: "", unit, quantity: 1, unitPrice: 0, unitCost: 0, manualPrice: false };
}

function blankSection(type: OfferEditorValues["type"]): SectionRow {
  return type === "WORKS"
    ? {
        key: newKey(),
        title: "",
        zone: "",
        description: "",
        areaM2: 0,
        isOption: false,
        items: [blankItem("MATERIAL", "kg"), { ...blankItem("LABOUR", "m2"), description: "Aplikimi" }],
      }
    : { key: newKey(), title: "Produkte", zone: "", description: "", areaM2: null, isOption: false, items: [blankItem("MATERIAL", "thes")] };
}

// Price one line from a given parameter set, respecting a manual override.
// Shared by the live editor recompute and the what-if analysis so both agree.
function priceLineWith(
  item: ItemRow,
  params: OfferParams,
  currency: "EUR" | "ALL",
  exchangeRate: number,
  productMap: Map<string, ProductOption>,
): ItemRow {
  if (item.manualPrice) return item;
  const supplier = item.kind === "LABOUR" ? null : productMap.get(item.productName.trim().toLowerCase())?.supplierPriceAll;
  const kind = (["MATERIAL", "LABOUR", "OTHER"].includes(item.kind) ? item.kind : "MATERIAL") as LineKind;
  const unit = priceUnit(kind, supplier, params);
  if (!unit) return item;
  return {
    ...item,
    unitPrice: round2(allToOffer(unit.sellPerUnitAll, currency, exchangeRate)),
    unitCost: round2(allToOffer(unit.costPerUnitAll, currency, exchangeRate)),
  };
}

type OfferEconomics = ReturnType<typeof offerTotals>;
// Re-price every line under a hypothetical parameter/scalar set and roll it up
// to the offer-level economics (offered value, cost, net profit, margin).
function offerEconomics(args: {
  sections: SectionRow[];
  params: OfferParams;
  currency: "EUR" | "ALL";
  exchangeRate: number;
  vatRate: number;
  discountPct: number;
  productMap: Map<string, ProductOption>;
}): OfferEconomics {
  const priced = args.sections.map((section) => ({
    ...section,
    items: section.items.map((item) => priceLineWith(item, args.params, args.currency, args.exchangeRate, args.productMap)),
  }));
  return offerTotals({ vatRate: args.vatRate, discountPct: args.discountPct, sections: priced });
}

export function OfferEditor({
  action,
  initial,
  products,
  clients = [],
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  initial: OfferEditorValues;
  products: ProductOption[];
  clients?: string[];
  submitLabel: string;
}) {
  const t = useT();
  const [type, setType] = useState(initial.type);
  const [currency, setCurrency] = useState(initial.currency);
  const [exchangeRate, setExchangeRate] = useState(initial.exchangeRate);
  const [vatRate, setVatRate] = useState(initial.vatRate);
  const [discountPct, setDiscountPct] = useState(initial.discountPct);
  const [params, setParams] = useState<OfferParams>(initial.params ?? DEFAULT_OFFER_PARAMS);
  const [techDescription, setTechDescription] = useState(initial.techDescription ?? "");
  const [techMissing, setTechMissing] = useState<string[]>([]);
  const productMap = useMemo(() => new Map(products.map((product) => [product.name.toLowerCase(), product])), [products]);
  const [sections, setSections] = useState<SectionRow[]>(() => {
    const base = initial.sections.length
      ? initial.sections.map((section) => ({ ...section, key: newKey(), items: section.items.map((item) => ({ ...item, key: newKey() })) }))
      : [blankSection(initial.type)];
    // Price any still-unpriced auto line up front, so a fresh offer shows real
    // figures right away instead of staying at 0 until the first edit. Saved
    // lines (already priced) and manual lines are left exactly as stored.
    const ip = initial.params ?? DEFAULT_OFFER_PARAMS;
    return base.map((section) => ({
      ...section,
      items: section.items.map((item) =>
        !item.manualPrice && item.unitPrice === 0 && item.unitCost === 0
          ? priceLineWith(item, ip, initial.currency, initial.exchangeRate, productMap)
          : item,
      ),
    }));
  });

  const totals = offerTotals({ vatRate, discountPct, sections });

  // Mapei "Analisi dei Prezzi" labour guidance: total man-hours to apply 1 m² of
  // the distinct selected products that carry a Mapei time. With the team size it
  // implies an expected m²/day to sanity-check the Rendimenti value.
  const mapeiLabour = useMemo(() => {
    const seen = new Set<string>();
    let manHours = 0;
    let withData = 0;
    for (const section of sections) {
      for (const item of section.items) {
        const product = productMap.get(item.productName.trim().toLowerCase());
        if (!product || seen.has(product.name)) continue;
        seen.add(product.name);
        if (product.labourManHoursPerM2 && product.labourManHoursPerM2 > 0) {
          manHours += product.labourManHoursPerM2;
          withData += 1;
        }
      }
    }
    return { manHours: Math.round(manHours * 1000) / 1000, withData };
  }, [sections, productMap]);

  // The supplier price (ALL) that backs a line, if it can be priced automatically.
  const supplierPriceForItem = (item: ItemRow): number | null | undefined => {
    if (item.kind === "LABOUR") return null; // priced from params, not a product
    return productMap.get(item.productName.trim().toLowerCase())?.supplierPriceAll;
  };
  // A line has an engine price source when it is labour or a catalogue product
  // with a supplier price. Such a line is auto-priced UNLESS the user has flipped
  // it to a hand-entered figure (manualPrice).
  const hasAutoSource = (item: ItemRow) =>
    item.kind === "LABOUR" || productMap.get(item.productName.trim().toLowerCase())?.supplierPriceAll != null;
  const isAutoPriced = (item: ItemRow) => !item.manualPrice && hasAutoSource(item);

  // Recompute a line's unit price & cost from the engine; manual lines are left as typed.
  const repriceItem = (item: ItemRow): ItemRow => {
    if (item.manualPrice) return item;
    const kind = (["MATERIAL", "LABOUR", "OTHER"].includes(item.kind) ? item.kind : "MATERIAL") as LineKind;
    const unit = priceUnit(kind, supplierPriceForItem(item), params);
    if (!unit) return item;
    return {
      ...item,
      unitPrice: round2(allToOffer(unit.sellPerUnitAll, currency, exchangeRate)),
      unitCost: round2(allToOffer(unit.costPerUnitAll, currency, exchangeRate)),
    };
  };

  // Keep every auto-priced line in sync with the parameters / currency.
  useEffect(() => {
    setSections((rows) => rows.map((section) => ({ ...section, items: section.items.map(repriceItem) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, currency, exchangeRate]);

  const updateSection = (key: string, patch: Partial<SectionRow>) =>
    setSections((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const updateItem = (sectionKey: string, itemKey: string, patch: Partial<ItemRow>) =>
    setSections((rows) =>
      rows.map((row) =>
        row.key === sectionKey ? { ...row, items: row.items.map((item) => (item.key === itemKey ? { ...item, ...patch } : item)) } : row,
      ),
    );
  // Switch a line between engine pricing and a hand-entered figure. Turning the
  // override OFF re-applies the engine price; turning it ON keeps the current
  // numbers as a starting point for the user to edit, and locks the recompute off.
  const setManual = (sectionKey: string, itemKey: string, manual: boolean) =>
    setSections((rows) =>
      rows.map((row) =>
        row.key === sectionKey
          ? {
              ...row,
              items: row.items.map((item) =>
                item.key === itemKey ? (manual ? { ...item, manualPrice: true } : repriceItem({ ...item, manualPrice: false })) : item,
              ),
            }
          : row,
      ),
    );
  // Append a line, pricing it immediately (a labour line auto-fills its cost
  // from the parameters right away instead of staying at 0 until something else
  // triggers a recompute).
  const addItem = (sectionKey: string, item: ItemRow) =>
    setSections((rows) =>
      rows.map((row) => (row.key === sectionKey ? { ...row, items: [...row.items, repriceItem(item)] } : row)),
    );
  // Changing kind can flip a line between material and labour pricing.
  const changeKind = (sectionKey: string, itemKey: string, kind: string) =>
    setSections((rows) =>
      rows.map((row) =>
        row.key === sectionKey ? { ...row, items: row.items.map((item) => (item.key === itemKey ? repriceItem({ ...item, kind }) : item)) } : row,
      ),
    );
  const moveSection = (index: number, delta: number) =>
    setSections((rows) => {
      const target = index + delta;
      if (target < 0 || target >= rows.length) return rows;
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const setParam = (key: keyof OfferParams, value: number) =>
    setParams((prev) => ({ ...prev, [key]: Number.isFinite(value) ? value : prev[key] }));

  // Assemble the technical-characteristics block from the distinct selected
  // products that have a stored (Mapei/Polyglass) description.
  const generateTechDescription = () => {
    const seen = new Set<string>();
    const blocks: string[] = [];
    const missing: string[] = [];
    for (const section of sections) {
      for (const item of section.items) {
        const product = productMap.get(item.productName.trim().toLowerCase());
        if (!product || seen.has(product.name)) continue;
        seen.add(product.name);
        if (product.techDescription) blocks.push(product.techDescription);
        else missing.push(product.name);
      }
    }
    setTechDescription(blocks.join("\n\n"));
    setTechMissing(missing);
  };

  // Picking a work category on a labour line fills the unit (m²) and the
  // client-facing line description, and adds the category's technical paragraph
  // to the offer's Technical Description. Pricing is left to the parameters /
  // manual override, exactly as before.
  const pickLabourCategory = (sectionKey: string, itemKey: string, categoryKey: string) => {
    const category = LABOUR_CATEGORIES.find((entry) => entry.key === categoryKey);
    setSections((rows) =>
      rows.map((row) =>
        row.key === sectionKey
          ? {
              ...row,
              items: row.items.map((item) =>
                item.key === itemKey && category
                  ? { ...item, unit: category.unit, description: category.clientDescription }
                  : item,
              ),
            }
          : row,
      ),
    );
    if (category?.techDescription) {
      setTechDescription((prev) =>
        prev.includes(category.techDescription) ? prev : [prev.trim(), category.techDescription].filter(Boolean).join("\n\n"),
      );
    }
  };

  // Picking a catalogue product fills the base unit, the TDS consumption/m², the
  // work-item text (if empty), and the engine-derived selling price & internal cost.
  const pickProduct = (sectionKey: string, itemKey: string, name: string) =>
    setSections((rows) =>
      rows.map((row) => {
        if (row.key !== sectionKey) return row;
        return {
          ...row,
          items: row.items.map((item) => {
            if (item.key !== itemKey) return item;
            const product = productMap.get(name.trim().toLowerCase());
            let next: ItemRow = { ...item, productName: name };
            if (product) {
              next.unit = product.baseUnit || product.unit || item.unit;
              if (product.consumptionPerM2 != null) next.quantity = product.consumptionPerM2;
              if (!next.description.trim() && product.workItem) next.description = product.workItem;
            }
            next = repriceItem(next);
            return next;
          }),
        };
      }),
    );

  const payload = JSON.stringify(
    sections.map(({ key: _key, items, ...section }) => ({ ...section, items: items.map(({ key: _itemKey, ...item }) => item) })),
  );

  const pct = (value: number) => round2(value * 100);

  // Live what-if analysis: the offer's economics now, and how the offered price
  // and net profit move when each driver is nudged by one step. Manual-price
  // lines are frozen (priceLineWith leaves them), so they don't react.
  const signed = (delta: number) => `${delta >= 0 ? "+" : "−"}${offerMoney(Math.abs(delta), currency)}`;
  const analysis = useMemo(() => {
    const baseArgs = { sections, params, currency, exchangeRate, vatRate, discountPct, productMap };
    const base = offerEconomics(baseArgs);
    const withParams = (patch: Partial<OfferParams>) => offerEconomics({ ...baseArgs, params: { ...params, ...patch } });
    const withScalars = (patch: { exchangeRate?: number; discountPct?: number }) =>
      offerEconomics({ ...baseArgs, exchangeRate: patch.exchangeRate ?? exchangeRate, discountPct: patch.discountPct ?? discountPct });
    const row = (label: string, current: string, change: string, econ: OfferEconomics) => ({
      label,
      current,
      change,
      dPrice: econ.net - base.net,
      dProfit: econ.profit - base.profit,
    });
    const rows = [
      row(t("off.analysis.drMargin"), `${pct(params.targetMarginPct)}%`, "+5 pp", withParams({ targetMarginPct: params.targetMarginPct + 0.05 })),
      row(t("off.analysis.drDailyRate"), `${params.dailyRateAll.toLocaleString("en-GB")} ALL`, "+500 ALL", withParams({ dailyRateAll: params.dailyRateAll + 500 })),
      row(t("off.analysis.drTeam"), String(params.teamSize), "+1", withParams({ teamSize: params.teamSize + 1 })),
      row(t("off.analysis.drYield"), `${params.yieldM2PerDay}`, "+5", withParams({ yieldM2PerDay: params.yieldM2PerDay + 5 })),
      row(t("off.analysis.drWaste"), `${pct(params.wastePct)}%`, "+1 pp", withParams({ wastePct: params.wastePct + 0.01 })),
      row(t("off.analysis.drMobilization"), `${pct(params.mobilizationPct)}%`, "+1 pp", withParams({ mobilizationPct: params.mobilizationPct + 0.01 })),
      row(t("off.analysis.drEquipment"), `${params.equipmentPerDayAll.toLocaleString("en-GB")} ALL`, "+500 ALL", withParams({ equipmentPerDayAll: params.equipmentPerDayAll + 500 })),
      ...(currency === "EUR" ? [row(t("off.analysis.drFx"), `${exchangeRate}`, "+1", withScalars({ exchangeRate: exchangeRate + 1 }))] : []),
      row(t("off.analysis.drDiscount"), `${discountPct}%`, "+1 pp", withScalars({ discountPct: discountPct + 1 })),
    ];
    return { base, rows };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, params, currency, exchangeRate, vatRate, discountPct, productMap, t]);

  // Cost → margin → price build-up for the whole job: decompose the total cost
  // into its components (materials, waste, labour, equipment, mobilization, and
  // any manual/other cost), then add the net profit to reach the offered price.
  // Components are scaled to the headline cost so they sum to it exactly.
  const breakdown = useMemo(() => {
    const conv = (valueAll: number) => allToOffer(valueAll, currency, exchangeRate);
    let materials = 0, waste = 0, labour = 0, equipment = 0, mobilization = 0, other = 0;
    for (const section of sections) {
      if (section.isOption) continue;
      const mult = section.areaM2 && section.areaM2 > 0 ? section.areaM2 : 1;
      for (const item of section.items) {
        const q = item.quantity * mult;
        if (item.manualPrice) {
          other += item.unitCost * q;
        } else if (item.kind === "LABOUR") {
          const yld = params.yieldM2PerDay > 0 ? params.yieldM2PerDay : 1;
          const lab = conv((params.dailyRateAll * params.teamSize) / yld) * q;
          const eq = conv(params.equipmentPerDayAll / yld) * q;
          labour += lab;
          equipment += eq;
          mobilization += (lab + eq) * params.mobilizationPct;
        } else {
          const p = productMap.get(item.productName.trim().toLowerCase())?.supplierPriceAll;
          if (p == null) {
            other += item.unitCost * q;
          } else {
            const matBase = conv(p) * q;
            const w = matBase * params.wastePct;
            materials += matBase;
            waste += w;
            mobilization += (matBase + w) * params.mobilizationPct;
          }
        }
      }
    }
    const base = analysis.base;
    const raw = materials + waste + labour + equipment + mobilization + other;
    const scale = raw > 0 ? base.cost / raw : 1;
    return {
      materials: materials * scale,
      waste: waste * scale,
      labour: labour * scale,
      equipment: equipment * scale,
      mobilization: mobilization * scale,
      other: other * scale,
      cost: base.cost,
      profit: base.profit,
      net: base.net,
      vat: base.vat,
      total: base.total,
      discount: base.discount,
      margin: base.margin,
    };
  }, [sections, params, currency, exchangeRate, productMap, analysis]);

  const buildRows = [
    { label: t("off.analysis.bMaterials"), v: breakdown.materials },
    { label: t("off.analysis.bWaste"), v: breakdown.waste },
    { label: t("off.analysis.bLabour"), v: breakdown.labour },
    { label: t("off.analysis.bEquipment"), v: breakdown.equipment },
    { label: t("off.analysis.bMobilization"), v: breakdown.mobilization },
    { label: t("off.analysis.bOther"), v: breakdown.other },
  ].filter((r) => Math.abs(r.v) > 0.005);
  const share = (v: number) => (breakdown.net > 0 ? (v / breakdown.net) * 100 : 0);

  return (
    <form action={action} className="grid gap-6">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="sections" value={payload} />
      <input type="hidden" name="params" value={JSON.stringify(params)} />

      <section className="panel grid gap-4 p-5 md:grid-cols-3">
        <label>
          {t("off.offerType")}
          <select name="type" value={type} onChange={(event) => setType(event.target.value as OfferEditorValues["type"])}>
            <option value="WORKS">{t("off.typeWorksOption")}</option>
            <option value="PRODUCTS">{t("off.typeProductsOption")}</option>
          </select>
        </label>
        <label>
          {t("off.client")}
          <input name="clientName" required list="offer-clients" defaultValue={initial.clientName} onFocus={(event) => event.currentTarget.select()} placeholder={t("off.clientPlaceholder")} autoComplete="off" />
        </label>
        <label>
          {t("off.projectSite")}
          <input name="projectName" required defaultValue={initial.projectName} placeholder="Farka Lake Front Residence" />
        </label>
        <label>
          {t("off.siteAddress")}
          <input name="siteAddress" defaultValue={initial.siteAddress} placeholder={t("common.optional")} />
        </label>
        <label>
          {t("off.issueDate")}
          <input name="issueDate" type="date" required defaultValue={initial.issueDate} />
        </label>
        <label>
          {t("off.validUntil")}
          <input name="validUntil" type="date" defaultValue={initial.validUntil} />
        </label>
        <label>
          {t("off.currency")}
          <select name="currency" value={currency} onChange={(event) => setCurrency(event.target.value as OfferEditorValues["currency"])}>
            <option value="EUR">EUR</option>
            <option value="ALL">ALL (Lek)</option>
          </select>
        </label>
        <label>
          {t("off.allPerEur")}
          <input name="exchangeRate" type="number" min="1" step="0.01" value={exchangeRate} onChange={(event) => setExchangeRate(Number(event.target.value))} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            {t("off.vatPct")}
            <input name="vatRate" type="number" min="0" step="0.1" value={vatRate} onChange={(event) => setVatRate(Number(event.target.value))} />
          </label>
          <label>
            {t("off.discountPct")}
            <input name="discountPct" type="number" min="0" max="100" step="0.1" value={discountPct} onChange={(event) => setDiscountPct(Number(event.target.value))} />
          </label>
        </div>
      </section>

      {/* Cost parameters — the shared assumptions that drive every line's price.
          Collapsed by default: set occasionally, with a live summary when closed. */}
      <details className="panel p-5">
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lab-burgundy">{t("off.params.title")}</div>
              <p className="mt-1 text-sm text-muted">
                {t("off.params.summary", {
                  margin: pct(params.targetMarginPct),
                  team: params.teamSize,
                  yield: params.yieldM2PerDay,
                  waste: pct(params.wastePct),
                })}
              </p>
            </div>
            <span className="btn btn-secondary btn-small">{t("off.params.show")}</span>
          </div>
        </summary>
        <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <fieldset className="grid gap-3">
            <legend className="text-xs font-bold uppercase tracking-wide text-muted">{t("off.params.groupLabour")}</legend>
            <label>{t("off.params.dailyRate")}<input type="number" min="0" step="100" value={params.dailyRateAll} onChange={(e) => setParam("dailyRateAll", Number(e.target.value))} /></label>
            <label>{t("off.params.teamSize")}<input type="number" min="1" step="1" value={params.teamSize} onChange={(e) => setParam("teamSize", Number(e.target.value))} /></label>
            <label>
              {t("off.params.yield")}
              <input type="number" min="1" step="1" value={params.yieldM2PerDay} onChange={(e) => setParam("yieldM2PerDay", Number(e.target.value))} />
              {mapeiLabour.withData > 0 && mapeiLabour.manHours > 0 ? (
                <span className="mt-1 block text-[11px] font-normal italic text-muted">
                  {t("off.params.mapeiYield", {
                    hours: mapeiLabour.manHours.toFixed(2),
                    team: params.teamSize,
                    m2: Math.round((params.teamSize * 8) / mapeiLabour.manHours),
                  })}
                </span>
              ) : null}
            </label>
          </fieldset>
          <fieldset className="grid gap-3">
            <legend className="text-xs font-bold uppercase tracking-wide text-muted">{t("off.params.groupMaterial")}</legend>
            <label>{t("off.params.waste")}<input type="number" min="0" step="0.1" value={pct(params.wastePct)} onChange={(e) => setParam("wastePct", Number(e.target.value) / 100)} /></label>
            <label>{t("off.params.fxBuffer")}<input type="number" min="0" step="0.1" value={pct(params.fxBufferPct)} onChange={(e) => setParam("fxBufferPct", Number(e.target.value) / 100)} /></label>
          </fieldset>
          <fieldset className="grid gap-3">
            <legend className="text-xs font-bold uppercase tracking-wide text-muted">{t("off.params.groupOperational")}</legend>
            <label>{t("off.params.mobilization")}<input type="number" min="0" step="0.1" value={pct(params.mobilizationPct)} onChange={(e) => setParam("mobilizationPct", Number(e.target.value) / 100)} /></label>
            <label>{t("off.params.equipment")}<input type="number" min="0" step="100" value={params.equipmentPerDayAll} onChange={(e) => setParam("equipmentPerDayAll", Number(e.target.value))} /></label>
          </fieldset>
          <fieldset className="grid gap-3">
            <legend className="text-xs font-bold uppercase tracking-wide text-muted">{t("off.params.groupProfit")}</legend>
            <label>{t("off.params.margin")}<input type="number" min="0" max="95" step="0.5" value={pct(params.targetMarginPct)} onChange={(e) => setParam("targetMarginPct", Number(e.target.value) / 100)} /></label>
            <label>{t("off.params.minMargin")}<input type="number" min="0" max="95" step="0.5" value={pct(params.minMarginPct)} onChange={(e) => setParam("minMarginPct", Number(e.target.value) / 100)} /></label>
          </fieldset>
          <fieldset className="grid gap-3">
            <legend className="text-xs font-bold uppercase tracking-wide text-muted">{t("off.params.groupReserves")}</legend>
            <label>{t("off.params.warranty")}<input type="number" min="0" step="0.1" value={pct(params.warrantyPct)} onChange={(e) => setParam("warrantyPct", Number(e.target.value) / 100)} /></label>
            <label>{t("off.params.contingency")}<input type="number" min="0" step="0.1" value={pct(params.contingencyPct)} onChange={(e) => setParam("contingencyPct", Number(e.target.value) / 100)} /></label>
          </fieldset>
        </div>
      </details>

      <datalist id="offer-clients">
        {clients.map((name) => <option key={name} value={name} />)}
      </datalist>
      <datalist id="offer-products">
        {products.map((product) => <option key={product.name} value={product.name} />)}
      </datalist>

      {sections.map((section, sectionIndex) => {
        const subtotal = sectionTotals(section);
        const perM2 = section.areaM2 !== null;
        return (
          <section key={section.key} className={`panel p-5 ${section.isOption ? "border-dashed" : ""}`}>
            <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_0.7fr_auto]">
              <label>
                {type === "WORKS" ? t("off.systemSection") : t("off.sectionFallback")}
                <input value={section.title} onChange={(event) => updateSection(section.key, { title: event.target.value })} placeholder="Hidroizolimi i tarracës me Mapeplan T M 15" />
              </label>
              <label>
                {t("off.zone")}
                <input value={section.zone} onChange={(event) => updateSection(section.key, { zone: event.target.value })} placeholder="Tarraca, Themele, Tualete…" />
              </label>
              <label>
                {perM2 ? t("off.areaM2") : t("off.pricing")}
                {perM2 ? (
                  <input type="number" min="0" step="0.01" value={section.areaM2 ?? 0} onChange={(event) => updateSection(section.key, { areaM2: Number(event.target.value) })} />
                ) : (
                  <input disabled value={t("off.absoluteQuantities")} />
                )}
              </label>
              <div className="flex flex-wrap items-end gap-2">
                <button className="btn btn-small btn-secondary" type="button" onClick={() => updateSection(section.key, { areaM2: perM2 ? null : 0 })}>
                  {perM2 ? t("off.useQuantities") : t("off.pricePerM2")}
                </button>
                <button className="btn btn-small btn-secondary" type="button" onClick={() => moveSection(sectionIndex, -1)} aria-label={t("off.moveSectionUp")}>↑</button>
                <button className="btn btn-small btn-secondary" type="button" onClick={() => moveSection(sectionIndex, 1)} aria-label={t("off.moveSectionDown")}>↓</button>
                <button className="btn btn-small btn-delete" type="button" onClick={() => setSections((rows) => rows.filter((row) => row.key !== section.key))}>{t("common.delete")}</button>
              </div>
            </div>
            <label className="mt-3">
              {t("off.descriptionShown")}
              <textarea rows={2} value={section.description} onChange={(event) => updateSection(section.key, { description: event.target.value })} placeholder="Përshkrimi teknik i sistemit" />
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input className="w-auto" type="checkbox" checked={section.isOption} onChange={(event) => updateSection(section.key, { isOption: event.target.checked })} />
              {t("off.altOptionLabel")}
            </label>

            <div className="table-wrap mt-4">
              <table>
                <thead>
                  <tr>
                    <th>{t("off.colType")}</th>
                    <th>{t("off.colWorkItem")}</th>
                    <th>{t("off.colProduct")}</th>
                    <th>{t("common.unit")}</th>
                    <th>{perM2 ? t("off.colConsumptionPerM2") : t("common.quantity")}</th>
                    <th>{t("off.colPricePerUnit")}</th>
                    <th>{t("off.colCostPerUnitInternal")}</th>
                    <th>{perM2 ? t("off.colValuePerM2") : t("off.colLineTotal")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((item) => {
                    const auto = isAutoPriced(item);
                    const product = productMap.get(item.productName.trim().toLowerCase());
                    const noPrice = item.kind !== "LABOUR" && product != null && product.supplierPriceAll == null;
                    const marginPct = item.unitPrice > 0 ? ((item.unitPrice - item.unitCost) / item.unitPrice) * 100 : 0;
                    return (
                      <tr key={item.key}>
                        <td>
                          <select className="w-28" value={item.kind} onChange={(event) => changeKind(section.key, item.key, event.target.value)}>
                            <option value="MATERIAL">{t("off.kindMaterial")}</option>
                            <option value="LABOUR">{t("off.kindLabour")}</option>
                            <option value="OTHER">{t("off.kindOther")}</option>
                          </select>
                        </td>
                        <td><input className="min-w-56" value={item.description} onChange={(event) => updateItem(section.key, item.key, { description: event.target.value })} placeholder="Shtresa hidroizoluese" /></td>
                        <td>
                          {item.kind === "LABOUR" ? (
                            <select
                              className="min-w-56"
                              value={labourCategoryForDescription(item.description)?.key ?? ""}
                              onChange={(event) => pickLabourCategory(section.key, item.key, event.target.value)}
                            >
                              <option value="">{t("off.puneCategoryPlaceholder")}</option>
                              {LABOUR_CATEGORIES.map((category) => (
                                <option key={category.key} value={category.key}>{category.label}</option>
                              ))}
                            </select>
                          ) : (
                            <>
                              <div className="flex items-center gap-1">
                                <input className="min-w-44" list="offer-products" value={item.productName} onFocus={(event) => event.currentTarget.select()} onChange={(event) => pickProduct(section.key, item.key, event.target.value)} placeholder="Mapelastic" />
                                {item.productName ? (
                                  <button
                                    type="button"
                                    className="shrink-0 rounded px-1.5 text-lg leading-none text-muted hover:text-lab-burgundy"
                                    title={t("off.clearProduct")}
                                    aria-label={t("off.clearProduct")}
                                    onClick={() => updateItem(section.key, item.key, { productName: "" })}
                                  >
                                    ×
                                  </button>
                                ) : null}
                              </div>
                              {product?.consumptionBasis ? <div className="mt-1 max-w-56 text-[11px] leading-tight text-muted">{product.consumptionBasis}</div> : null}
                            </>
                          )}
                        </td>
                        <td>
                          <input className="w-24" list="offer-units" value={item.unit} onChange={(event) => updateItem(section.key, item.key, { unit: event.target.value })} />
                        </td>
                        <td><input className="w-28" type="number" min="0" step="0.001" value={item.quantity} onChange={(event) => updateItem(section.key, item.key, { quantity: Number(event.target.value) })} /></td>
                        <td>
                          {auto ? (
                            <div className="w-28 font-semibold text-ink">
                              {offerMoney(item.unitPrice, currency)}
                              <button
                                type="button"
                                className="mt-0.5 block text-left text-[11px] font-normal text-muted underline decoration-dotted hover:text-lab-burgundy"
                                onClick={() => setManual(section.key, item.key, true)}
                              >
                                {t("off.autoFromCatalogue")} · {t("off.setManual")}
                              </button>
                            </div>
                          ) : (
                            <div className="grid w-28 gap-0.5">
                              <input className="w-28" type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(section.key, item.key, { unitPrice: Number(event.target.value) })} />
                              {hasAutoSource(item) ? (
                                <button
                                  type="button"
                                  className="text-left text-[11px] text-muted underline decoration-dotted hover:text-lab-burgundy"
                                  onClick={() => setManual(section.key, item.key, false)}
                                >
                                  {t("off.manualPrice")} · {t("off.revertAuto")}
                                </button>
                              ) : noPrice ? (
                                <div className="text-[11px] font-semibold text-lab-burgundy">{t("off.noSupplierPrice")}</div>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td>
                          {auto ? (
                            <div className="w-28 text-muted">
                              {offerMoney(item.unitCost, currency)}
                              <div className="text-[11px]">{t("off.lineMargin")} {marginPct.toFixed(0)}%</div>
                            </div>
                          ) : (
                            <input className="w-28" type="number" min="0" step="0.01" value={item.unitCost} onChange={(event) => updateItem(section.key, item.key, { unitCost: Number(event.target.value) })} />
                          )}
                        </td>
                        <td className="font-bold">{offerMoney(item.quantity * item.unitPrice, currency)}</td>
                        <td>
                          <button className="btn btn-small btn-delete" type="button" onClick={() => updateSection(section.key, { items: section.items.filter((row) => row.key !== item.key) })}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-2">
                <button className="btn btn-small btn-secondary" type="button" onClick={() => addItem(section.key, blankItem("MATERIAL", perM2 ? "kg" : "thes"))}>{t("off.addMaterial")}</button>
                <button className="btn btn-small btn-secondary" type="button" onClick={() => addItem(section.key, { ...blankItem("LABOUR", "m2"), description: "Aplikimi" })}>{t("off.addLabour")}</button>
              </div>
              <div className="text-sm font-semibold text-ink">
                {perM2 ? <>{t("off.valuePerM2")}: {offerMoney(subtotal.ratePrice, currency)} · </> : null}
                {t("off.sectionTotal")}: {offerMoney(subtotal.total, currency)}
                <span className="text-muted"> · {t("off.costWord")} {offerMoney(subtotal.cost, currency)}</span>
              </div>
            </div>
          </section>
        );
      })}

      <datalist id="offer-units">
        {ITEM_UNITS.map((unit) => <option key={unit} value={unit} />)}
      </datalist>

      <div>
        <button className="btn btn-secondary" type="button" onClick={() => setSections((rows) => [...rows, blankSection(type)])}>
          {t("off.addSection")}
        </button>
      </div>

      <section className="panel grid gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lab-burgundy">{t("off.techHeader")}</div>
            <p className="mt-1 text-sm text-muted">{t("off.techHint")}</p>
          </div>
          <button className="btn btn-secondary btn-small" type="button" onClick={generateTechDescription}>{t("off.generateTech")}</button>
        </div>
        <label>
          {t("off.techFieldLabel")}
          <textarea name="techDescription" rows={8} value={techDescription} onChange={(event) => setTechDescription(event.target.value)} />
        </label>
        {techMissing.length ? (
          <p className="text-xs font-semibold text-lab-burgundy">
            {t(techMissing.length === 1 ? "off.techMissingOne" : "off.techMissingMany", { count: techMissing.length, names: techMissing.join(", ") })}
          </p>
        ) : null}
      </section>

      <details className="panel p-5">
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lab-burgundy">{t("off.termsTitle")}</div>
              <p className="mt-1 text-sm text-muted">{t("off.termsHint")}</p>
            </div>
            <span className="btn btn-secondary btn-small">{t("off.params.show")}</span>
          </div>
        </summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label>{t("off.paymentTerms")}<textarea name="paymentTerms" rows={3} defaultValue={initial.paymentTerms} /></label>
          <label>{t("off.executionDelivery")}<textarea name="executionTerms" rows={3} defaultValue={initial.executionTerms} /></label>
          <label>{t("off.warranty")}<textarea name="warrantyTerms" rows={3} defaultValue={initial.warrantyTerms} /></label>
          <label>{t("off.exclusions")}<textarea name="exclusions" rows={3} defaultValue={initial.exclusions} /></label>
          <label className="md:col-span-2">{t("off.internalNotesNeverPrinted")}<textarea name="internalNotes" rows={2} defaultValue={initial.internalNotes} /></label>
        </div>
      </details>

      <section className="panel grid gap-4 p-5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lab-burgundy">{t("off.analysis.title")}</div>
          <p className="mt-1 text-sm text-muted">{t("off.analysis.hint")}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: t("off.analysis.offered"), value: offerMoney(analysis.base.net, currency) },
            { label: t("off.analysis.total"), value: offerMoney(analysis.base.total, currency) },
            { label: t("off.analysis.cost"), value: offerMoney(analysis.base.cost, currency) },
            { label: t("off.analysis.profit"), value: offerMoney(analysis.base.profit, currency) },
            { label: t("off.analysis.margin"), value: `${analysis.base.margin.toFixed(1)}%` },
          ].map((card) => (
            <div key={card.label} className="rounded-lg border border-line bg-white p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted">{card.label}</div>
              <div className="mt-1 text-lg font-bold leading-tight text-ink">{card.value}</div>
            </div>
          ))}
        </div>
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t("off.analysis.buildTitle")}</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("off.analysis.colVariable")}</th>
                  <th>{t("off.analysis.colAmount")}</th>
                  <th>{t("off.analysis.colShare")}</th>
                </tr>
              </thead>
              <tbody>
                {buildRows.map((r) => (
                  <tr key={r.label}>
                    <td className="pl-4 text-ink">{r.label}</td>
                    <td>{offerMoney(r.v, currency)}</td>
                    <td className="text-muted">{share(r.v).toFixed(1)}%</td>
                  </tr>
                ))}
                <tr className="border-t border-line font-semibold">
                  <td className="text-ink">{t("off.analysis.bCost")}</td>
                  <td className="text-ink">{offerMoney(breakdown.cost, currency)}</td>
                  <td className="text-muted">{share(breakdown.cost).toFixed(1)}%</td>
                </tr>
                <tr className="font-semibold text-lab-green">
                  <td>
                    + {t("off.analysis.bProfit")}{" "}
                    <span className="font-normal text-muted">
                      ({t("off.margin")} {breakdown.margin.toFixed(1)}%
                      {breakdown.discount > 0 ? `, ${t("off.analysis.bProfitAfterDiscount", { discount: round2(discountPct) })}` : ""})
                    </span>
                  </td>
                  <td>{offerMoney(breakdown.profit, currency)}</td>
                  <td className="text-muted">{share(breakdown.profit).toFixed(1)}%</td>
                </tr>
                <tr className="border-t border-line text-base font-bold">
                  <td className="text-ink">= {t("off.analysis.bOffered")}</td>
                  <td className="text-ink">{offerMoney(breakdown.net, currency)}</td>
                  <td className="text-muted">100%</td>
                </tr>
                <tr>
                  <td className="text-muted">{t("off.analysis.bVat")}</td>
                  <td className="text-muted">{offerMoney(breakdown.vat, currency)}</td>
                  <td />
                </tr>
                <tr className="font-semibold">
                  <td className="text-ink">{t("off.analysis.bTotal")}</td>
                  <td className="text-ink">{offerMoney(breakdown.total, currency)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t("off.analysis.sensTitle")}</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("off.analysis.colVariable")}</th>
                  <th>{t("off.analysis.colCurrent")}</th>
                  <th>{t("off.analysis.colChange")}</th>
                  <th>{t("off.analysis.colDeltaPrice")}</th>
                  <th>{t("off.analysis.colDeltaProfit")}</th>
                </tr>
              </thead>
              <tbody>
                {analysis.rows.map((r) => (
                  <tr key={r.label}>
                    <td className="font-semibold text-ink">{r.label}</td>
                    <td className="text-muted">{r.current}</td>
                    <td className="text-muted">{r.change}</td>
                    <td className={r.dPrice >= 0 ? "font-semibold text-lab-green" : "font-semibold text-lab-burgundy"}>{signed(r.dPrice)}</td>
                    <td className={r.dProfit >= 0 ? "font-semibold text-lab-green" : "font-semibold text-lab-burgundy"}>{signed(r.dProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted">{t("off.analysis.note")}</p>
        </div>
      </section>

      <section className="panel sticky bottom-0 z-10 flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div className="grid gap-1 text-sm">
          <div className="font-bold text-ink">
            {t("off.net")} {offerMoney(totals.net, currency)} · {t("off.vat")} {offerMoney(totals.vat, currency)} · {t("common.total")} {offerMoney(totals.total, currency)}
          </div>
          <div className="text-muted">
            {t("off.internalLabel")}: {t("off.costWord")} {offerMoney(totals.cost, currency)} · {t("off.margin")} {totals.margin.toFixed(1)}%
            {totals.margin > 0 && totals.margin < params.minMarginPct * 100 ? ` — ${t("off.belowMinMargin")}` : ""}
            {totals.areaM2 ? ` · ${totals.areaM2.toFixed(1)} m²` : ""}
          </div>
        </div>
        <button className="btn btn-primary" type="submit">{submitLabel}</button>
      </section>
    </form>
  );
}
