import { createOffer } from "@/app/actions";
import { PageTitle } from "@/components/PageTitle";
import { OfferEditor } from "../OfferEditor";
import { blankOfferValues, offerProductOptions } from "../editor-values";

export default async function NewOfferPage() {
  const products = await offerProductOptions();

  return (
    <>
      <PageTitle eyebrow="Offers" title="New offer" />
      <OfferEditor action={createOffer} initial={blankOfferValues()} products={products} submitLabel="Save draft" />
    </>
  );
}
