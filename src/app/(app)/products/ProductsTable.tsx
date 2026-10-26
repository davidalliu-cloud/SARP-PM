"use client";

import { useMemo, useState } from "react";
import type { Product } from "@prisma/client";
import { updateProduct } from "@/app/actions";
import { DeleteProductButton } from "@/components/DeleteProductButton";
import { money } from "@/lib/format";
import { useT } from "@/components/LanguageProvider";

export function ProductsTable({ products }: { products: Product[] }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredProducts = useMemo(() => {
    if (!normalizedQuery) return products;
    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.unit.toLowerCase().includes(normalizedQuery) ||
        String(product.defaultCostPerUnit).includes(normalizedQuery)
      );
    });
  }, [products, normalizedQuery]);

  return (
    <div className="panel flex min-h-0 flex-col overflow-hidden">
      <div className="border-b border-[#d7e1e5] bg-white p-4">
        <label>
          {t("products.searchProducts")}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("products.searchPlaceholder")}
          />
        </label>
        <div className="mt-2 text-xs font-bold text-muted">
          {t("products.showing", { shown: filteredProducts.length, total: products.length })}
        </div>
      </div>
      <div className="table-wrap min-h-0 flex-1 overflow-auto">
        <table>
          <thead className="sticky top-0 z-10 bg-white">
            <tr><th>{t("products.colProduct")}</th><th>{t("products.unit")}</th><th>{t("products.colDefaultCost")}</th><th>{t("common.actions")}</th></tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => (
              <tr key={product.id}>
                <td>
                  <form id={`product-${product.id}`} action={updateProduct}>
                    <input type="hidden" name="id" value={product.id} />
                    <input className="h-9 py-1.5" name="name" defaultValue={product.name} required aria-label={`Name for ${product.name}`} />
                  </form>
                </td>
                <td>
                  <input className="h-9 py-1.5" form={`product-${product.id}`} name="unit" defaultValue={product.unit} required aria-label={`Unit for ${product.name}`} />
                </td>
                <td>
                  <input className="h-9 py-1.5" form={`product-${product.id}`} name="defaultCostPerUnit" type="number" min="0" step="0.01" defaultValue={product.defaultCostPerUnit} required aria-label={`Cost for ${product.name}`} />
                  <div className="mt-1 text-xs font-bold text-muted">{money(product.defaultCostPerUnit)}</div>
                </td>
                <td>
                  <div className="flex flex-nowrap gap-2">
                    <button form={`product-${product.id}`} className="btn btn-small btn-save" type="submit">{t("common.save")}</button>
                    <DeleteProductButton id={product.id} name={product.name} />
                  </div>
                </td>
              </tr>
            ))}
            {!filteredProducts.length ? (
              <tr><td colSpan={4} className="py-8 text-center font-bold text-muted">{t("products.noMatch")}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
