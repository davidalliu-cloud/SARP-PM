import Link from "next/link";
import { notFound } from "next/navigation";
import { updateOffer } from "@/app/actions";
import { PageTitle } from "@/components/PageTitle";
import { requireUser } from "@/lib/auth";
import { canEditOffer } from "@/lib/offers";
import { prisma } from "@/lib/prisma";
import { OfferEditor } from "../../OfferEditor";
import { offerProductOptions, offerToEditorValues } from "../../editor-values";

export default async function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, offer, products] = await Promise.all([
    requireUser(),
    prisma.offer.findUnique({
      where: { id },
      include: { sections: { orderBy: { sortOrder: "asc" }, include: { items: { orderBy: { sortOrder: "asc" } } } } },
    }),
    offerProductOptions(),
  ]);
  if (!offer) notFound();

  if (!canEditOffer(user, offer)) {
    return (
      <>
        <PageTitle eyebrow={offer.code} title="Edit offer" />
        <div className="panel p-5 font-bold text-lab-burgundy">
          This offer can no longer be edited. <Link className="underline" href={`/offers/${offer.id}`}>Back to offer</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle eyebrow={offer.code} title={`Edit · ${offer.projectName}`} />
      <OfferEditor action={updateOffer} initial={offerToEditorValues(offer)} products={products} submitLabel="Save changes" />
    </>
  );
}
