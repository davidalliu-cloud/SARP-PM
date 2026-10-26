import { createProduct } from "@/app/actions";
import { PageTitle } from "@/components/PageTitle";
import { getT } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { ProductsTable } from "./ProductsTable";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const t = await getT();
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <PageTitle eyebrow={t("products.eyebrow")} title={t("products.title")} />
      {params.error === "product-used" ? (
        <div className="panel mb-5 border-[#e0b7c0] bg-[#f9eef1] p-4 font-bold text-lab-burgundy">
          {t("products.usedError")}
        </div>
      ) : null}
      {params.deleted ? (
        <div className="panel mb-5 border-[#c8decf] bg-[#eef7f1] p-4 font-bold text-[#285d59]">
          {t("products.deleted")}
        </div>
      ) : null}
      <section className="grid h-[calc(100vh-190px)] min-h-[640px] gap-5 xl:grid-cols-[360px_1fr]">
        <form action={createProduct} className="panel grid content-start gap-4 p-4 xl:sticky xl:top-6 xl:self-start">
          <h2 className="text-lg font-bold">{t("products.addProduct")}</h2>
          <label>{t("products.productName")}<input name="name" required placeholder="Torch-on membrane" /></label>
          <label>{t("products.unit")}<input name="unit" required placeholder="roll, tin, sqm" /></label>
          <label>{t("products.defaultCostPerUnit")}<input name="defaultCostPerUnit" type="number" min="0" step="0.01" required placeholder="78.00" /></label>
          <button className="btn btn-primary" type="submit">{t("products.addProduct")}</button>
        </form>
        <ProductsTable products={products} />
      </section>
    </>
  );
}
