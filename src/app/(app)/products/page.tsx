import { createProduct } from "@/app/actions";
import { PageTitle } from "@/components/PageTitle";
import { prisma } from "@/lib/prisma";
import { ProductsTable } from "./ProductsTable";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <PageTitle eyebrow="Master data" title="Products" />
      {params.error === "product-used" ? (
        <div className="panel mb-5 border-[#e0b7c0] bg-[#f9eef1] p-4 font-bold text-[#5b193f]">
          This product is already used in a project daily record, so it cannot be deleted.
        </div>
      ) : null}
      {params.deleted ? (
        <div className="panel mb-5 border-[#c8decf] bg-[#eef7f1] p-4 font-bold text-[#285d59]">
          Product deleted.
        </div>
      ) : null}
      <section className="grid h-[calc(100vh-190px)] min-h-[640px] gap-5 xl:grid-cols-[360px_1fr]">
        <form action={createProduct} className="panel grid content-start gap-4 p-4 xl:sticky xl:top-6 xl:self-start">
          <h2 className="text-lg font-black">Add product</h2>
          <label>Product name<input name="name" required placeholder="Torch-on membrane" /></label>
          <label>Unit<input name="unit" required placeholder="roll, tin, sqm" /></label>
          <label>Default cost per unit<input name="defaultCostPerUnit" type="number" min="0" step="0.01" required placeholder="78.00" /></label>
          <button className="btn btn-primary" type="submit">Add product</button>
        </form>
        <ProductsTable products={products} />
      </section>
    </>
  );
}
