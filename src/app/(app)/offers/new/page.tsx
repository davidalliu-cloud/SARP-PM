import { createOffer } from "@/app/actions";
import { PageTitle } from "@/components/PageTitle";
import { getT } from "@/lib/i18n-server";
import { OfferEditor } from "../OfferEditor";
import { blankOfferValues, offerClientOptions, offerProductOptions } from "../editor-values";

export default async function NewOfferPage() {
  const [products, clients, t] = await Promise.all([offerProductOptions(), offerClientOptions(), getT()]);

  return (
    <>
      <PageTitle eyebrow={t("off.eyebrowOffers")} title={t("off.newOffer")} />
      <OfferEditor action={createOffer} initial={blankOfferValues()} products={products} clients={clients} submitLabel={t("common.saveDraft")} />
    </>
  );
}
