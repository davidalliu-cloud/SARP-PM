"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/components/LanguageProvider";
import { ITEM_UNITS, offerMoney, offerTotals, sectionTotals } from "@/lib/offer-calc";
import {
  DEFAULT_OFFER_PARAMS,
  materialUnitCost,
  priceUnit,
  type LineKind,
  type OfferParams,
} from "@/lib/offer-costing";
import { LABOUR_CATEGORIES, labourCategoryForDescription } from "@/lib/labour-categories";
import { OFFER_SYSTEMS, OFFER_ZONES, systemForLabel } from "@/lib/offer-systems";

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
  fixedCost: boolean;
};

type SectionRow = {
  key: string;
  title: string;
  zone: string;
  description: string;
  areaM2: number | null;
  isOption: boolean;
  yieldM2PerDay: number | null;
  teamSize: number | null;
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
  priceEur: number | null;
  workItem: string | null;
  techDescription: string | null;
  labourManHoursPerM2: number | null;
  labourWorkers: number | null;
};

let keySeed = 0;
const newKey = () => `k${Date.now()}-${keySeed++}`;
const round2 = (value: number) => Math.round(value * 100) / 100;

function blankItem(kind = "MATERIAL", unit = "kg"): ItemRow {
  return { key: newKey(), kind, description: "", productName: "", unit, quantity: 1, unitPrice: 0, unitCost: 0, manualPrice: false, fixedCost: false };
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
        yieldM2PerDay: null,
        teamSize: null,
        items: [blankItem("MATERIAL", "kg"), { ...blankItem("LABOUR", "m2"), description: "Aplikimi" }],
      }
    : { key: newKey(), title: "Produkte", zone: "", description: "", areaM2: null, isOption: false, yieldM2PerDay: null, teamSize: null, items: [blankItem("MATERIAL", "thes")] };
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
  // Fixed-cost line (e.g. a subcontractor's agreed rate): the user owns the
  // cost; only the sell price is derived, by applying the target margin.
  if (item.fixedCost) {
    const m = Math.min(Math.max(params.targetMarginPct, 0), 0.95);
    return { ...item, unitPrice: round2(item.unitCost / (1 - m)) };
  }
  const product = item.kind === "LABOUR" ? null : productMap.get(item.productName.trim().toLowerCase());
  const kind = (["MATERIAL", "LABOUR", "OTHER"].includes(item.kind) ? item.kind : "MATERIAL") as LineKind;
  const unit = priceUnit(
    kind,
    product ? { priceEur: product.priceEur, supplierPriceAll: product.supplierPriceAll } : null,
    params,
    currency,
    exchangeRate,
  );
  if (!unit) return item;
  return { ...item, unitPrice: round2(unit.sellPerUnit), unitCost: round2(unit.costPerUnit) };
}

// Effective labour params for a section: its own yield / crew override the
// offer-level ones (a blank/≤0 override falls back to the offer default).
function sectionParams(section: { yieldM2PerDay: number | null; teamSize: number | null }, base: OfferParams): OfferParams {
  return {
    ...base,
    yieldM2PerDay: section.yieldM2PerDay != null && section.yieldM2PerDay > 0 ? section.yieldM2PerDay : base.yieldM2PerDay,
    teamSize: section.teamSize != null && section.teamSize > 0 ? section.teamSize : base.teamSize,
  };
}

type OfferEconomics = ReturnType<typeof offerTotals>;
// Re-price every line under a hypothetical parameter/scalar set and roll it up
// to the offer-level economics (offered value, cost, net profit, margin). Each
// section is priced with its own effective labour params.
function offerEconomics(args: {
  sections: SectionRow[];
  params: OfferParams;
  currency: "EUR" | "ALL";
  exchangeRate: number;
  vatRate: number;
  discountPct: number;
  productMap: Map<string, ProductOption>;
}): OfferEconomics {
  const priced = args.sections.map((section) => {
    const sp = sectionParams(section, args.params);
    return { ...section, items: section.items.map((item) => priceLineWith(item, sp, args.currency, args.exchangeRate, args.productMap)) };
  });
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
    return base.map((section) => {
      const sp = sectionParams(section, ip);
      return {
        ...section,
        items: section.items.map((item) =>
          !item.manualPrice && item.unitPrice === 0 && item.unitCost === 0
            ? priceLineWith(item, sp, initial.currency, initial.exchangeRate, productMap)
            : item,
        ),
      };
    });
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

  // A line has an engine price source when it is labour or a catalogue product
  // with a price usable in the offer's currency. Such a line is auto-priced
  // UNLESS the user has flipped it to a hand-entered figure (manualPrice).
  const productPriced = (item: ItemRow) => {
    const product = productMap.get(item.productName.trim().toLowerCase());
    return product != null && materialUnitCost({ priceEur: product.priceEur, supplierPriceAll: product.supplierPriceAll }, currency, exchangeRate) != null;
  };
  const hasAutoSource = (item: ItemRow) => item.kind === "LABOUR" || productPriced(item);
  const isAutoPriced = (item: ItemRow) => !item.manualPrice && hasAutoSource(item);

  // Re-price a whole section from the engine, using that section's effective
  // labour params (its own yield / crew override the offer defaults). Manual
  // lines are left as typed; fixed-cost lines keep their cost, only the price.
  const repriceSection = (section: SectionRow): SectionRow => {
    const sp = sectionParams(section, params);
    return { ...section, items: section.items.map((it) => priceLineWith(it, sp, currency, exchangeRate, productMap)) };
  };
  // The line's cost is user-entered (editable) unless the engine computes it.
  const costIsComputed = (item: ItemRow) => isAutoPriced(item) && !item.fixedCost;

  // Keep every auto-priced line in sync with the parameters / currency.
  useEffect(() => {
    setSections((rows) => rows.map(repriceSection));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, currency, exchangeRate]);

  const updateSection = (key: string, patch: Partial<SectionRow>) =>
    setSections((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  // Set a section's labour override (yield / crew) and re-price its labour lines
  // immediately from the section's effective params.
  const setSectionLabour = (key: string, patch: Partial<Pick<SectionRow, "yieldM2PerDay" | "teamSize">>) =>
    setSections((rows) => rows.map((row) => (row.key === key ? repriceSection({ ...row, ...patch }) : row)));
  // Set the section title; if it matches a known system (i.e. picked from the
  // dropdown), also fill the client-facing description. Custom titles are left
  // alone, so typing a one-off system never overwrites a hand-written blurb.
  const pickSystem = (sectionKey: string, title: string) =>
    setSections((rows) =>
      rows.map((row) => {
        if (row.key !== sectionKey) return row;
        const system = systemForLabel(title);
        return system ? { ...row, title, description: system.clientDescription } : { ...row, title };
      }),
    );
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
          ? repriceSection({ ...row, items: row.items.map((item) => (item.key === itemKey ? { ...item, manualPrice: manual } : item)) })
          : row,
      ),
    );
  // Set a line's cost from the editable cost input, re-deriving the price where
  // the engine owns it (fixed-cost lines re-apply the margin; manual lines keep
  // their own price).
  const setCost = (sectionKey: string, itemKey: string, unitCost: number) =>
    setSections((rows) =>
      rows.map((row) =>
        row.key === sectionKey
          ? repriceSection({ ...row, items: row.items.map((item) => (item.key === itemKey ? { ...item, unitCost } : item)) })
          : row,
      ),
    );
  // Labour cost source: day-rate × team (fixed=false) vs a fixed subcontractor
  // rate the user types (fixed=true, with the margin still applied on top).
  const setLabourFixed = (sectionKey: string, itemKey: string, fixed: boolean) =>
    setSections((rows) =>
      rows.map((row) =>
        row.key === sectionKey
          ? repriceSection({ ...row, items: row.items.map((item) => (item.key === itemKey ? { ...item, fixedCost: fixed } : item)) })
          : row,
      ),
    );
  // Append a line, pricing it immediately (a labour line auto-fills its cost
  // from the parameters right away instead of staying at 0 until something else
  // triggers a recompute).
  const addItem = (sectionKey: string, item: ItemRow) =>
    setSections((rows) => rows.map((row) => (row.key === sectionKey ? repriceSection({ ...row, items: [...row.items, item] }) : row)));
  // Changing kind can flip a line between material and labour pricing.
  const changeKind = (sectionKey: string, itemKey: string, kind: string) =>
    setSections((rows) =>
      rows.map((row) =>
        row.key === sectionKey ? repriceSection({ ...row, items: row.items.map((item) => (item.key === itemKey ? { ...item, kind } : item)) }) : row,
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
  // Reorder a line within its section (up = −1, down = +1). The array order is
  // what gets saved as each item's sortOrder, so this persists on save.
  const moveItem = (sectionKey: string, index: number, delta: number) =>
    setSections((rows) =>
      rows.map((row) => {
        if (row.key !== sectionKey) return row;
        const target = index + delta;
        if (target < 0 || target >= row.items.length) return row;
        const items = [...row.items];
        [items[index], items[target]] = [items[target], items[index]];
        return { ...row, items };
      }),
    );
  const setParam = (key: keyof OfferParams, value: number) =>
    setParams((prev) => ({ ...prev, [key]: Number.isFinite(value) ? value : prev[key] }));
  // Switching the offer currency converts the figures that are kept in the
  // offer currency (day-rate, equipment, and any hand-entered/subcontractor line
  // amounts) by the exchange rate, so the offer stays economically the same.
  // Catalogue-priced lines re-derive themselves in the new currency.
  const changeCurrency = (next: "EUR" | "ALL") => {
    if (next === currency) return;
    const factor = next === "ALL" ? exchangeRate : exchangeRate > 0 ? 1 / exchangeRate : 1;
    setParams((prev) => ({
      ...prev,
      dailyRateAll: round2(prev.dailyRateAll * factor),
      equipmentPerDayAll: round2(prev.equipmentPerDayAll * factor),
    }));
    setSections((rows) =>
      rows.map((row) => ({
        ...row,
        items: row.items.map((item) =>
          item.manualPrice || item.fixedCost
            ? { ...item, unitPrice: round2(item.unitPrice * factor), unitCost: round2(item.unitCost * factor) }
            : item,
        ),
      })),
    );
    setCurrency(next);
  };

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
        return repriceSection({
          ...row,
          items: row.items.map((item) => {
            if (item.key !== itemKey) return item;
            const product = productMap.get(name.trim().toLowerCase());
            const next: ItemRow = { ...item, productName: name };
            if (product) {
              next.unit = product.baseUnit || product.unit || item.unit;
              if (product.consumptionPerM2 != null) next.quantity = product.consumptionPerM2;
              if (!next.description.trim() && product.workItem) next.description = product.workItem;
            }
            return next;
          }),
        });
      }),
    );

  const payload = JSON.stringify(
    sections.map(({ key: _key, items, ...section }) => ({ ...section, items: items.map(({ key: _itemKey, ...item }) => item) })),
  );

  const pct = (value: number) => round2(value * 100);
  const paramHelp = "mt-0.5 block text-[11px] font-normal italic text-muted";

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
    const cashStep = currency === "EUR" ? 5 : 500;
    const rows = [
      row(t("off.analysis.drMargin"), `${pct(params.targetMarginPct)}%`, "+5 pp", withParams({ targetMarginPct: params.targetMarginPct + 0.05 })),
      row(t("off.analysis.drDailyRate"), offerMoney(params.dailyRateAll, currency), `+${cashStep}`, withParams({ dailyRateAll: params.dailyRateAll + cashStep })),
      row(t("off.analysis.drTeam"), String(params.teamSize), "+1", withParams({ teamSize: params.teamSize + 1 })),
      row(t("off.analysis.drYield"), `${params.yieldM2PerDay}`, "+5", withParams({ yieldM2PerDay: params.yieldM2PerDay + 5 })),
      row(t("off.analysis.drMobilization"), `${pct(params.mobilizationPct)}%`, "+1 pp", withParams({ mobilizationPct: params.mobilizationPct + 0.01 })),
      row(t("off.analysis.drEquipment"), offerMoney(params.equipmentPerDayAll, currency), `+${cashStep}`, withParams({ equipmentPerDayAll: params.equipmentPerDayAll + cashStep })),
      ...(currency === "ALL" ? [row(t("off.analysis.drFx"), `${exchangeRate}`, "+1", withScalars({ exchangeRate: exchangeRate + 1 }))] : []),
      row(t("off.analysis.drDiscount"), `${discountPct}%`, "+1 pp", withScalars({ discountPct: discountPct + 1 })),
    ];
    return { base, rows };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, params, currency, exchangeRate, vatRate, discountPct, productMap, t]);

  // Per-line internal cost & profit sheet ("hapësirë pune e brendshme"): every
  // line's supplier price, consumption, material/labour cost, total cost, sell
  // price, profit and real margin. Job totals are taken from analysis.base so
  // they match the sticky bar. Internal only — never shown to the client.
  const lineAnalysis = useMemo(() => {
    return sections
      .filter((section) => !section.isOption)
      .flatMap((section) =>
        section.items.map((item) => {
          const isLabour = item.kind === "LABOUR";
          const product = isLabour ? undefined : productMap.get(item.productName.trim().toLowerCase());
          const supplierUnit = product
            ? materialUnitCost({ priceEur: product.priceEur, supplierPriceAll: product.supplierPriceAll }, currency, exchangeRate)
            : null;
          return {
            key: item.key,
            desc: item.description,
            product: item.productName.trim() || (isLabour ? t("off.kindLabour") : "—"),
            unit: item.unit,
            isLabour,
            manual: item.manualPrice,
            supplierUnit,
            consumption: item.quantity,
            materialCost: isLabour ? 0 : item.unitCost,
            labourCost: isLabour ? item.unitCost : 0,
            totalCost: item.unitCost,
            sell: item.unitPrice,
            profit: item.unitPrice - item.unitCost,
            realMargin: item.unitPrice > 0 ? ((item.unitPrice - item.unitCost) / item.unitPrice) * 100 : 0,
          };
        }),
      );
  }, [sections, currency, exchangeRate, productMap, t]);

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
          <select name="currency" value={currency} onChange={(event) => changeCurrency(event.target.value as OfferEditorValues["currency"])}>
            <option value="EUR">EUR</option>
            <option value="ALL">ALL (Lek)</option>
          </select>
        </label>
        {currency === "ALL" ? (
          <label>
            {t("off.allPerEur")}
            <input name="exchangeRate" type="number" min="1" step="0.01" value={exchangeRate} onChange={(event) => setExchangeRate(Number(event.target.value))} />
          </label>
        ) : (
          <input type="hidden" name="exchangeRate" value={exchangeRate} />
        )}
        <label>
          {t("off.vatPct")}
          <input name="vatRate" type="number" min="0" step="0.1" value={vatRate} onChange={(event) => setVatRate(Number(event.target.value))} />
        </label>
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
                })}
              </p>
            </div>
            <span className="btn btn-secondary btn-small">{t("off.params.show")}</span>
          </div>
        </summary>
        <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <fieldset className="grid gap-3">
            <legend className="text-xs font-bold uppercase tracking-wide text-muted">{t("off.params.groupLabour")}</legend>
            <label>{t("off.params.dailyRate")}<input type="number" min="0" step="any" value={params.dailyRateAll} onChange={(e) => setParam("dailyRateAll", Number(e.target.value))} /><span className={paramHelp}>{t("off.params.dailyRateHelp")}</span></label>
            <label>{t("off.params.teamSize")}<input type="number" min="1" step="1" value={params.teamSize} onChange={(e) => setParam("teamSize", Number(e.target.value))} /><span className={paramHelp}>{t("off.params.teamSizeHelp")}</span></label>
            <label>
              {t("off.params.yield")}
              <input type="number" min="1" step="1" value={params.yieldM2PerDay} onChange={(e) => setParam("yieldM2PerDay", Number(e.target.value))} />
              <span className={paramHelp}>{t("off.params.yieldHelp")}</span>
              {mapeiLabour.withData > 0 && mapeiLabour.manHours > 0 ? (
                <span className="mt-0.5 block text-[11px] font-normal italic text-muted">
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
            <legend className="text-xs font-bold uppercase tracking-wide text-muted">{t("off.params.groupOperational")}</legend>
            <label>{t("off.params.mobilization")}<input type="number" min="0" step="0.1" value={pct(params.mobilizationPct)} onChange={(e) => setParam("mobilizationPct", Number(e.target.value) / 100)} /><span className={paramHelp}>{t("off.params.mobilizationHelp")}</span></label>
            <label>{t("off.params.equipment")}<input type="number" min="0" step="any" value={params.equipmentPerDayAll} onChange={(e) => setParam("equipmentPerDayAll", Number(e.target.value))} /><span className={paramHelp}>{t("off.params.equipmentHelp")}</span></label>
          </fieldset>
          <fieldset className="grid gap-3">
            <legend className="text-xs font-bold uppercase tracking-wide text-muted">{t("off.params.groupProfit")}</legend>
            <label>{t("off.params.margin")}<input type="number" min="0" max="95" step="0.5" value={pct(params.targetMarginPct)} onChange={(e) => setParam("targetMarginPct", Number(e.target.value) / 100)} /><span className={paramHelp}>{t("off.params.marginHelp")}</span></label>
            <label>{t("off.params.minMargin")}<input type="number" min="0" max="95" step="0.5" value={pct(params.minMarginPct)} onChange={(e) => setParam("minMarginPct", Number(e.target.value) / 100)} /><span className={paramHelp}>{t("off.params.minMarginHelp")}</span></label>
            <label>{t("off.discountPct")}<input name="discountPct" type="number" min="0" max="100" step="0.5" value={discountPct} onChange={(e) => setDiscountPct(Number(e.target.value))} /><span className={paramHelp}>{t("off.discountHelp")}</span></label>
          </fieldset>
          <fieldset className="grid gap-3">
            <legend className="text-xs font-bold uppercase tracking-wide text-muted">{t("off.params.groupReserves")}</legend>
            <label>{t("off.params.warranty")}<input type="number" min="0" step="0.1" value={pct(params.warrantyPct)} onChange={(e) => setParam("warrantyPct", Number(e.target.value) / 100)} /><span className={paramHelp}>{t("off.params.warrantyHelp")}</span></label>
            <label>{t("off.params.contingency")}<input type="number" min="0" step="0.1" value={pct(params.contingencyPct)} onChange={(e) => setParam("contingencyPct", Number(e.target.value) / 100)} /><span className={paramHelp}>{t("off.params.contingencyHelp")}</span></label>
          </fieldset>
          <fieldset className="grid gap-3">
            <legend className="text-xs font-bold uppercase tracking-wide text-muted">{t("off.params.groupMaterial")}</legend>
            <p className="text-[11px] italic text-muted">{t("off.params.wasteNote")}</p>
          </fieldset>
        </div>
      </details>

      <datalist id="offer-clients">
        {clients.map((name) => <option key={name} value={name} />)}
      </datalist>
      <datalist id="offer-products">
        {products.map((product) => <option key={product.name} value={product.name} />)}
      </datalist>
      <datalist id="offer-systems">
        {OFFER_SYSTEMS.map((system) => <option key={system.key} value={system.label} />)}
      </datalist>
      <datalist id="offer-zones">
        {OFFER_ZONES.map((zone) => <option key={zone} value={zone} />)}
      </datalist>

      {sections.map((section, sectionIndex) => {
        const subtotal = sectionTotals(section);
        const perM2 = section.areaM2 !== null;
        return (
          <section key={section.key} className={`panel p-5 ${section.isOption ? "border-dashed" : ""}`}>
            <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_0.7fr_auto]">
              <label>
                {type === "WORKS" ? t("off.systemSection") : t("off.sectionFallback")}
                <input list="offer-systems" value={section.title} onChange={(event) => pickSystem(section.key, event.target.value)} placeholder="Hidroizolimi i tarracës me Mapeplan T M 15" />
              </label>
              <label>
                {t("off.zone")}
                <input list="offer-zones" value={section.zone} onChange={(event) => updateSection(section.key, { zone: event.target.value })} placeholder="Tarraca, Themele, Tualete…" />
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
            {perM2 ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-white/60 p-3 text-sm">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t("off.sectionLabour")}</span>
                <label className="flex items-center gap-2 font-normal">
                  {t("off.params.yield")}
                  <input
                    className="w-24"
                    type="number"
                    min="0"
                    step="any"
                    value={section.yieldM2PerDay ?? ""}
                    placeholder={`${params.yieldM2PerDay}`}
                    onChange={(e) => setSectionLabour(section.key, { yieldM2PerDay: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </label>
                <label className="flex items-center gap-2 font-normal">
                  {t("off.params.teamSize")}
                  <input
                    className="w-20"
                    type="number"
                    min="0"
                    step="1"
                    value={section.teamSize ?? ""}
                    placeholder={`${params.teamSize}`}
                    onChange={(e) => setSectionLabour(section.key, { teamSize: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </label>
                <span className="text-[11px] italic text-muted">{t("off.sectionLabourHelp")}</span>
              </div>
            ) : null}
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
                  {section.items.map((item, itemIndex) => {
                    const auto = isAutoPriced(item);
                    const product = productMap.get(item.productName.trim().toLowerCase());
                    const noPrice = item.kind !== "LABOUR" && product != null && !productPriced(item);
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
                            <div className="w-28">
                              <div className="font-semibold text-ink">{offerMoney(item.unitPrice, currency)}</div>
                              <button
                                type="button"
                                className="mt-0.5 block w-full text-left text-[11px] font-normal leading-tight text-muted underline decoration-dotted hover:text-lab-burgundy"
                                onClick={() => setManual(section.key, item.key, true)}
                              >
                                {t("off.setManual")}
                              </button>
                            </div>
                          ) : (
                            <div className="grid w-28 gap-0.5">
                              <input className="w-28" type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(section.key, item.key, { unitPrice: Number(event.target.value) })} />
                              {hasAutoSource(item) ? (
                                <button
                                  type="button"
                                  className="block w-full text-left text-[11px] leading-tight text-muted underline decoration-dotted hover:text-lab-burgundy"
                                  onClick={() => setManual(section.key, item.key, false)}
                                >
                                  {t("off.revertAuto")}
                                </button>
                              ) : noPrice ? (
                                <div className="w-full text-[11px] font-semibold leading-tight text-lab-burgundy">{t("off.noSupplierPrice")}</div>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td>
                          {costIsComputed(item) ? (
                            <div className="w-28 text-muted">
                              <div>{offerMoney(item.unitCost, currency)}</div>
                              <div className="text-[11px] leading-tight">{t("off.lineMargin")} {marginPct.toFixed(0)}%</div>
                              {item.kind === "LABOUR" ? (
                                <button
                                  type="button"
                                  className="mt-0.5 block w-full text-left text-[11px] leading-tight text-muted underline decoration-dotted hover:text-lab-burgundy"
                                  onClick={() => setLabourFixed(section.key, item.key, true)}
                                >
                                  {t("off.subcontractor")}
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <div className="grid w-28 gap-0.5">
                              <input className="w-28" type="number" min="0" step="0.01" value={item.unitCost} onChange={(event) => setCost(section.key, item.key, Number(event.target.value))} />
                              {item.kind === "LABOUR" && item.fixedCost ? (
                                <button
                                  type="button"
                                  className="block w-full text-left text-[11px] leading-tight text-muted underline decoration-dotted hover:text-lab-burgundy"
                                  onClick={() => setLabourFixed(section.key, item.key, false)}
                                >
                                  {t("off.backToDayRate")}
                                </button>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="font-bold">{offerMoney(item.quantity * item.unitPrice, currency)}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button className="btn btn-small btn-secondary" type="button" disabled={itemIndex === 0} aria-label={t("off.moveRowUp")} title={t("off.moveRowUp")} onClick={() => moveItem(section.key, itemIndex, -1)}>↑</button>
                            <button className="btn btn-small btn-secondary" type="button" disabled={itemIndex === section.items.length - 1} aria-label={t("off.moveRowDown")} title={t("off.moveRowDown")} onClick={() => moveItem(section.key, itemIndex, 1)}>↓</button>
                            <button className="btn btn-small btn-delete" type="button" onClick={() => updateSection(section.key, { items: section.items.filter((row) => row.key !== item.key) })}>✕</button>
                          </div>
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lab-burgundy">{t("off.analysis.title")}</div>
            <span className="rounded bg-lab-burgundy/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lab-burgundy">{t("off.analysis.internalBadge")}</span>
          </div>
          <p className="mt-1 text-sm text-muted">{t("off.analysis.hint")}</p>
        </div>
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t("off.analysis.perLineTitle")}</div>
          <div className="table-wrap">
            <table className="text-[12px]">
              <thead>
                <tr>
                  <th>{t("off.analysis.cNr")}</th>
                  <th>{t("off.colWorkItem")}</th>
                  <th>{t("off.analysis.cSupplierProduct")}</th>
                  <th>{t("common.unit")}</th>
                  <th>{t("off.analysis.cSupplierPrice")}</th>
                  <th>{t("off.analysis.cConsumption")}</th>
                  <th>{t("off.analysis.cMatCost")}</th>
                  <th>{t("off.analysis.cLabourCost")}</th>
                  <th>{t("off.analysis.cTotalCost")}</th>
                  <th>{t("off.analysis.cTargetMargin")}</th>
                  <th>{t("off.analysis.cSell")}</th>
                  <th>{t("off.analysis.cProfit")}</th>
                  <th>{t("off.analysis.cRealMargin")}</th>
                </tr>
              </thead>
              <tbody>
                {lineAnalysis.map((r, i) => (
                  <tr key={r.key}>
                    <td className="text-muted">{i + 1}</td>
                    <td className="min-w-40 text-ink">{r.desc || "—"}</td>
                    <td className="min-w-32 text-muted">{r.product}</td>
                    <td>{r.unit}</td>
                    <td>{r.supplierUnit != null ? offerMoney(r.supplierUnit, currency) : "—"}</td>
                    <td>{r.consumption}</td>
                    <td>{offerMoney(r.materialCost, currency)}</td>
                    <td>{offerMoney(r.labourCost, currency)}</td>
                    <td className="font-semibold text-ink">{offerMoney(r.totalCost, currency)}</td>
                    <td className="text-muted">{r.manual ? t("off.manualPrice") : `${(params.targetMarginPct * 100).toFixed(1)}%`}</td>
                    <td className="font-semibold text-ink">{offerMoney(r.sell, currency)}</td>
                    <td className="text-lab-green">{offerMoney(r.profit, currency)}</td>
                    <td className="text-muted">{r.realMargin.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 grid gap-1 text-sm md:max-w-xl">
            <div className="flex justify-between border-t border-line pt-2 font-semibold">
              <span className="text-ink">{t("off.analysis.tCost")}</span>
              <span className="text-ink">{offerMoney(analysis.base.cost, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">{t("off.analysis.tSell")}</span>
              <span className="text-ink">{offerMoney(analysis.base.subtotal, currency)}</span>
            </div>
            {analysis.base.discount > 0 ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted">{t("off.analysis.tDiscount")} ({round2(discountPct)}%)</span>
                  <span className="text-lab-burgundy">−{offerMoney(analysis.base.discount, currency)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-ink">{t("off.analysis.tNet")}</span>
                  <span className="text-ink">{offerMoney(analysis.base.net, currency)}</span>
                </div>
              </>
            ) : null}
            <div className="flex justify-between">
              <span className="text-muted">{t("off.analysis.tRealMargin")}</span>
              <span className="font-semibold text-ink">{analysis.base.margin.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-muted">{t("off.analysis.tMinMargin")}</span>
              <span className={analysis.base.margin > 0 && analysis.base.margin < params.minMarginPct * 100 ? "font-semibold text-lab-burgundy" : "text-muted"}>
                {(params.minMarginPct * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
              <span className="text-ink">{t("off.analysis.tProfit")}</span>
              <span className="text-lab-green">{offerMoney(analysis.base.profit, currency)}</span>
            </div>
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
