"use client";

import { useMemo, useState, useTransition } from "react";
import { createDailyRecord } from "@/app/actions";
import { useT } from "@/components/LanguageProvider";
import { useModalClose } from "@/components/Modal";
import { dateInputValue } from "@/lib/format";

type ProductOption = {
  id: string;
  name: string;
  unit: string;
  defaultCostPerUnit: number;
  lastCostPerUnit?: number | null;
};

function productCost(product?: ProductOption) {
  return product?.lastCostPerUnit ?? product?.defaultCostPerUnit ?? 0;
}

export function MaterialsRecordForm({
  projectId,
  products,
  defaultClientName,
}: {
  projectId: string;
  products: ProductOption[];
  defaultClientName?: string;
}) {
  const t = useT();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [productRows, setProductRows] = useState([{ id: "p-0", productId: products[0]?.id ?? "", quantity: 1, costPerUnit: productCost(products[0]) }]);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const productTotal = productRows.reduce((sum, row) => sum + row.quantity * row.costPerUnit, 0);

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          await createDailyRecord(formData);
          close();
        })
      }
      className="grid gap-5"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid gap-4 md:grid-cols-[220px_1fr_1fr]">
        <label>
          {t("common.date")}
          <input name="date" type="date" required defaultValue={dateInputValue()} />
        </label>
        <label>
          {t("pd.daily.client")}
          <input name="clientName" placeholder={defaultClientName || t("pd.daily.clientPlaceholder")} defaultValue={defaultClientName || ""} />
        </label>
        <label>
          {t("common.notes")}
          <input name="notes" placeholder={t("pd.materialsForm.notesPlaceholder")} />
        </label>
      </div>
      <input type="hidden" name="completedAreaM2" value="0" />

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">{t("pd.daily.productsUsed")}</h3>
          <button
            className="btn btn-small btn-secondary"
            type="button"
            onClick={() => setProductRows((rows) => [...rows, { id: `p-${Date.now()}`, productId: products[0]?.id ?? "", quantity: 1, costPerUnit: productCost(products[0]) }])}
          >
            {t("pd.daily.addProductRow")}
          </button>
        </div>
        <div className="grid gap-3">
          {productRows.map((row, index) => {
            const selected = productMap.get(row.productId);
            return (
              <div key={row.id} className="grid gap-3 md:grid-cols-[1.5fr_0.7fr_0.8fr_0.8fr_auto]">
                <label>
                  {t("pd.daily.product")}
                  <select
                    name="productId"
                    value={row.productId}
                    onChange={(event) => {
                      const product = productMap.get(event.target.value);
                      setProductRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, productId: event.target.value, costPerUnit: productCost(product) } : item));
                    }}
                  >
                    {products.map((product) => <option key={product.id} value={product.id}>{product.name} / {product.unit}</option>)}
                  </select>
                </label>
                <label>
                  {t("common.quantity")}
                  <input name="productQuantity" type="number" min="0" step="0.01" value={row.quantity} onChange={(event) => setProductRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(event.target.value) } : item))} />
                </label>
                <label>
                  {t("pd.daily.costPerUnit")}
                  <input name="productCostPerUnit" type="number" min="0" step="0.01" value={row.costPerUnit} onChange={(event) => setProductRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, costPerUnit: Number(event.target.value) } : item))} />
                </label>
                <div className="grid content-end rounded-lg border border-[#d7e1e5] bg-[#f1f3f5] px-3 py-2">
                  <div className="text-xs font-bold uppercase text-muted">{t("pd.daily.lineTotal")}</div>
                  <div className="font-bold">EUR {(row.quantity * row.costPerUnit).toFixed(2)} {selected?.unit ? `/${selected.unit}` : ""}</div>
                </div>
                <div className="grid content-end">
                  <button className="btn btn-small btn-delete" type="button" onClick={() => setProductRows((rows) => rows.filter((item) => item.id !== row.id))}>
                    {t("common.delete")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm font-bold text-ink">
          {t("pd.materialsForm.total")} <span className="text-ink">EUR {productTotal.toFixed(2)}</span>
        </div>
        <button className="btn btn-primary" type="submit" disabled={pending || !products.length}>
          {pending ? t("pd.materialsForm.saving") : t("pd.materialsForm.save")}
        </button>
      </div>
    </form>
  );
}
