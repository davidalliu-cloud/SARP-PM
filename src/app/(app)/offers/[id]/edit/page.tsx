import Link from "next/link";
import { notFound } from "next/navigation";
import { updateOffer } from "@/app/actions";
import { PageTitle } from "@/components/PageTitle";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { canEditOffer } from "@/lib/offers";
import { prisma } from "@/lib/prisma";
import { OfferEditor } from "../../OfferEditor";
import { offerClientOptions, offerProductOptions, offerToEditorValues } from "../../editor-values";

export default async function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, offer, products, clients, t] = await Promise.all([
    requireUser(),
    prisma.offer.findUnique({
      where: { id },
      include: { sections: { orderBy: { sortOrder: "asc" }, include: { items: { orderBy: { sortOrder: "asc" } } } } },
    }),
    offerProductOptions(),
    offerClientOptions(),
    getT(),
  ]);
  if (!offer) notFound();

  if (!canEditOffer(user, offer)) {
    return (
      <>
        <PageTitle eyebrow={offer.code} title={t("off.editOffer")} />
        <div className="panel p-5 font-bold text-lab-burgundy">
          {t("off.cannotEdit")} <Link className="underline" href={`/offers/${offer.id}`}>{t("off.backToOffer")}</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle eyebrow={offer.code} title={`${t("off.editPrefix")} · ${offer.projectName}`} />
      <OfferEditor action={updateOffer} initial={offerToEditorValues(offer)} products={products} clients={clients} submitLabel={t("common.saveChanges")} />
    </>
  );
}
