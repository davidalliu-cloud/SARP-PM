"use client";

import { useMemo, useState } from "react";
import type { Product } from "@prisma/client";
import { updateProduct } from "@/app/actions";
import { DeleteProductButton } from "@/components/DeleteProductButton";
import { money } from "@/lib/format";

export function ProductsTable({ products }: { products: Product[] }) {
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
          Search products
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by product name, unit, or cost"
          />
        </label>
        <div className="mt-2 text-xs font-bold text-[#6b7188]">
          Showing {filteredProducts.length} of {products.length} products
        </div>
      </div>
      <div className="table-wrap min-h-0 flex-1 overflow-auto">
        <table>
          <thead className="sticky top-0 z-10 bg-white">
            <tr><th>Product</th><th>Unit</th><th>Default cost</th><th>Actions</th></tr>
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
                  <div className="mt-1 text-xs font-bold text-[#6b7188]">{money(product.defaultCostPerUnit)}</div>
                </td>
                <td>
                  <div className="flex flex-nowrap gap-2">
                    <button form={`product-${product.id}`} className="btn btn-small btn-save" type="submit">Save</button>
                    <DeleteProductButton id={product.id} name={product.name} />
                  </div>
                </td>
              </tr>
            ))}
            {!filteredProducts.length ? (
              <tr><td colSpan={4} className="py-8 text-center font-bold text-[#6b7188]">No products match your search.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
