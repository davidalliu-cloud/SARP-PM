"use client";

import { useMemo, useState } from "react";
import { ITEM_UNITS, offerMoney, offerTotals, sectionTotals } from "@/lib/offer-calc";

type ItemRow = {
  key: string;
  kind: string;
  description: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
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
  paymentTerms: string;
  executionTerms: string;
  warrantyTerms: string;
  exclusions: string;
  internalNotes: string;
  sections: (Omit<SectionRow, "key" | "items"> & { items: Omit<ItemRow, "key">[] })[];
};

type ProductOption = { name: string; unit: string; defaultCostPerUnit: number };

let keySeed = 0;
const newKey = () => `k${Date.now()}-${keySeed++}`;

function blankItem(kind = "MATERIAL", unit = "kg"): ItemRow {
  return { key: newKey(), kind, description: "", productName: "", unit, quantity: 1, unitPrice: 0, unitCost: 0 };
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

export function OfferEditor({
  action,
  initial,
  products,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  initial: OfferEditorValues;
  products: ProductOption[];
  submitLabel: string;
}) {
  const [type, setType] = useState(initial.type);
  const [currency, setCurrency] = useState(initial.currency);
  const [exchangeRate, setExchangeRate] = useState(initial.exchangeRate);
  const [vatRate, setVatRate] = useState(initial.vatRate);
  const [discountPct, setDiscountPct] = useState(initial.discountPct);
  const [sections, setSections] = useState<SectionRow[]>(() =>
    initial.sections.length
      ? initial.sections.map((section) => ({ ...section, key: newKey(), items: section.items.map((item) => ({ ...item, key: newKey() })) }))
      : [blankSection(initial.type)],
  );

  const productMap = useMemo(() => new Map(products.map((product) => [product.name.toLowerCase(), product])), [products]);
  const totals = offerTotals({ vatRate, discountPct, sections });

  const updateSection = (key: string, patch: Partial<SectionRow>) =>
    setSections((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const updateItem = (sectionKey: string, itemKey: string, patch: Partial<ItemRow>) =>
    setSections((rows) =>
      rows.map((row) =>
        row.key === sectionKey ? { ...row, items: row.items.map((item) => (item.key === itemKey ? { ...item, ...patch } : item)) } : row,
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

  // Picking a known product fills unit and internal cost (products are costed in EUR).
  const pickProduct = (sectionKey: string, itemKey: string, name: string) => {
    const product = productMap.get(name.trim().toLowerCase());
    updateItem(sectionKey, itemKey, {
      productName: name,
      ...(product
        ? { unit: product.unit, unitCost: Number((product.defaultCostPerUnit * (currency === "ALL" ? exchangeRate : 1)).toFixed(2)) }
        : {}),
    });
  };

  const payload = JSON.stringify(
    sections.map(({ key: _key, items, ...section }) => ({ ...section, items: items.map(({ key: _itemKey, ...item }) => item) })),
  );

  return (
    <form action={action} className="grid gap-6">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="sections" value={payload} />

      <section className="panel grid gap-4 p-5 md:grid-cols-3">
        <label>
          Offer type
          <select name="type" value={type} onChange={(event) => setType(event.target.value as OfferEditorValues["type"])}>
            <option value="WORKS">Oferta Punimeve (works, priced per m²)</option>
            <option value="PRODUCTS">Oferta Produkteve (product supply)</option>
          </select>
        </label>
        <label>
          Client
          <input name="clientName" required defaultValue={initial.clientName} placeholder="Klar shpk" />
        </label>
        <label>
          Project / site
          <input name="projectName" required defaultValue={initial.projectName} placeholder="Farka Lake Front Residence" />
        </label>
        <label>
          Site address
          <input name="siteAddress" defaultValue={initial.siteAddress} placeholder="Optional" />
        </label>
        <label>
          Issue date
          <input name="issueDate" type="date" required defaultValue={initial.issueDate} />
        </label>
        <label>
          Valid until
          <input name="validUntil" type="date" defaultValue={initial.validUntil} />
        </label>
        <label>
          Currency
          <select name="currency" value={currency} onChange={(event) => setCurrency(event.target.value as OfferEditorValues["currency"])}>
            <option value="EUR">EUR</option>
            <option value="ALL">ALL (Lek)</option>
          </select>
        </label>
        <label>
          ALL per 1 EUR
          <input name="exchangeRate" type="number" min="1" step="0.01" value={exchangeRate} onChange={(event) => setExchangeRate(Number(event.target.value))} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            VAT %
            <input name="vatRate" type="number" min="0" step="0.1" value={vatRate} onChange={(event) => setVatRate(Number(event.target.value))} />
          </label>
          <label>
            Discount %
            <input name="discountPct" type="number" min="0" max="100" step="0.1" value={discountPct} onChange={(event) => setDiscountPct(Number(event.target.value))} />
          </label>
        </div>
      </section>

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
                {type === "WORKS" ? "System / section" : "Section"}
                <input value={section.title} onChange={(event) => updateSection(section.key, { title: event.target.value })} placeholder="Hidroizolimi i tarracës me Mapeplan T M 15" />
              </label>
              <label>
                Zone
                <input value={section.zone} onChange={(event) => updateSection(section.key, { zone: event.target.value })} placeholder="Tarraca, Themele, Tualete…" />
              </label>
              <label>
                {perM2 ? "Area (m²)" : "Pricing"}
                {perM2 ? (
                  <input type="number" min="0" step="0.01" value={section.areaM2 ?? 0} onChange={(event) => updateSection(section.key, { areaM2: Number(event.target.value) })} />
                ) : (
                  <input disabled value="Absolute quantities" />
                )}
              </label>
              <div className="flex flex-wrap items-end gap-2">
                <button className="btn btn-small btn-secondary" type="button" onClick={() => updateSection(section.key, { areaM2: perM2 ? null : 0 })}>
                  {perM2 ? "Use quantities" : "Price per m²"}
                </button>
                <button className="btn btn-small btn-secondary" type="button" onClick={() => moveSection(sectionIndex, -1)} aria-label="Move section up">↑</button>
                <button className="btn btn-small btn-secondary" type="button" onClick={() => moveSection(sectionIndex, 1)} aria-label="Move section down">↓</button>
                <button className="btn btn-small btn-delete" type="button" onClick={() => setSections((rows) => rows.filter((row) => row.key !== section.key))}>Delete</button>
              </div>
            </div>
            <label className="mt-3">
              Description shown to client
              <textarea rows={2} value={section.description} onChange={(event) => updateSection(section.key, { description: event.target.value })} placeholder="Përshkrimi teknik i sistemit" />
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input className="w-auto" type="checkbox" checked={section.isOption} onChange={(event) => updateSection(section.key, { isOption: event.target.checked })} />
              Alternative option (shown to client, not added to total)
            </label>

            <div className="table-wrap mt-4">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Zëri i punës</th>
                    <th>Produkti</th>
                    <th>Unit</th>
                    <th>{perM2 ? "Consumption / m²" : "Quantity"}</th>
                    <th>Price / unit</th>
                    <th>Cost / unit (internal)</th>
                    <th>{perM2 ? "Value / m²" : "Line total"}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((item) => (
                    <tr key={item.key}>
                      <td>
                        <select className="w-28" value={item.kind} onChange={(event) => updateItem(section.key, item.key, { kind: event.target.value })}>
                          <option value="MATERIAL">Material</option>
                          <option value="LABOUR">Labour</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </td>
                      <td><input className="min-w-56" value={item.description} onChange={(event) => updateItem(section.key, item.key, { description: event.target.value })} placeholder="Shtresa hidroizoluese" /></td>
                      <td><input className="min-w-48" list="offer-products" value={item.productName} onChange={(event) => pickProduct(section.key, item.key, event.target.value)} placeholder="Mapelastic" /></td>
                      <td>
                        <input className="w-24" list="offer-units" value={item.unit} onChange={(event) => updateItem(section.key, item.key, { unit: event.target.value })} />
                      </td>
                      <td><input className="w-28" type="number" min="0" step="0.001" value={item.quantity} onChange={(event) => updateItem(section.key, item.key, { quantity: Number(event.target.value) })} /></td>
                      <td><input className="w-28" type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(section.key, item.key, { unitPrice: Number(event.target.value) })} /></td>
                      <td><input className="w-28" type="number" min="0" step="0.01" value={item.unitCost} onChange={(event) => updateItem(section.key, item.key, { unitCost: Number(event.target.value) })} /></td>
                      <td className="font-bold">{offerMoney(item.quantity * item.unitPrice, currency)}</td>
                      <td>
                        <button className="btn btn-small btn-delete" type="button" onClick={() => updateSection(section.key, { items: section.items.filter((row) => row.key !== item.key) })}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-2">
                <button className="btn btn-small btn-secondary" type="button" onClick={() => updateSection(section.key, { items: [...section.items, blankItem("MATERIAL", perM2 ? "kg" : "thes")] })}>Add material</button>
                <button className="btn btn-small btn-secondary" type="button" onClick={() => updateSection(section.key, { items: [...section.items, { ...blankItem("LABOUR", "m2"), description: "Aplikimi" }] })}>Add labour</button>
              </div>
              <div className="text-sm font-semibold text-ink">
                {perM2 ? <>Value / m²: {offerMoney(subtotal.ratePrice, currency)} · </> : null}
                Section total: {offerMoney(subtotal.total, currency)}
                <span className="text-muted"> · cost {offerMoney(subtotal.cost, currency)}</span>
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
          Add section
        </button>
      </div>

      <section className="panel grid gap-4 p-5 md:grid-cols-2">
        <label>Payment terms<textarea name="paymentTerms" rows={3} defaultValue={initial.paymentTerms} /></label>
        <label>Execution / delivery<textarea name="executionTerms" rows={3} defaultValue={initial.executionTerms} /></label>
        <label>Warranty<textarea name="warrantyTerms" rows={3} defaultValue={initial.warrantyTerms} /></label>
        <label>Exclusions<textarea name="exclusions" rows={3} defaultValue={initial.exclusions} /></label>
        <label className="md:col-span-2">Internal notes (never printed)<textarea name="internalNotes" rows={2} defaultValue={initial.internalNotes} /></label>
      </section>

      <section className="panel sticky bottom-0 z-10 flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div className="grid gap-1 text-sm">
          <div className="font-bold text-ink">
            Net {offerMoney(totals.net, currency)} · VAT {offerMoney(totals.vat, currency)} · Total {offerMoney(totals.total, currency)}
          </div>
          <div className="text-muted">
            Internal: cost {offerMoney(totals.cost, currency)} · margin {totals.margin.toFixed(1)}%
            {totals.areaM2 ? ` · ${totals.areaM2.toFixed(1)} m²` : ""}
          </div>
        </div>
        <button className="btn btn-primary" type="submit">{submitLabel}</button>
      </section>
    </form>
  );
}
