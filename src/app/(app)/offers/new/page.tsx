import { createOffer } from "@/app/actions";
import { PageTitle } from "@/components/PageTitle";
import { OfferEditor } from "../OfferEditor";
import { blankOfferValues, offerClientOptions, offerProductOptions } from "../editor-values";

export default async function NewOfferPage() {
  const [products, clients] = await Promise.all([offerProductOptions(), offerClientOptions()]);

  return (
    <>
      <PageTitle eyebrow="Offers" title="New offer" />
      <OfferEditor action={createOffer} initial={blankOfferValues()} products={products} clients={clients} submitLabel="Save draft" />
    </>
  );
}
