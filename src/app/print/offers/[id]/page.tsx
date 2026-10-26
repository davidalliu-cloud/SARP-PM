import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { offerMoney, offerTotals, sectionTotals } from "@/lib/offer-calc";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "./PrintButton";

// Client-facing offer document. Never render unitCost, margin or internal notes here.
export default async function PrintOfferPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const t = await getT();
  const offer = await prisma.offer.findUnique({
    where: { id },
    include: {
      sections: { orderBy: { sortOrder: "asc" }, include: { items: { orderBy: { sortOrder: "asc" } } } },
      approvedBy: { select: { name: true } },
    },
  });
  if (!offer) notFound();

  const totals = offerTotals(offer);
  const money = (value: number) => offerMoney(value, offer.currency);
  const isDraft = offer.status === "DRAFT" || offer.status === "PENDING_APPROVAL";
  const terms = [
    [t("off.printPaymentTerms"), offer.paymentTerms],
    [offer.type === "WORKS" ? t("off.printExecutionDeadline") : t("off.printDeliveryTime"), offer.executionTerms],
    [t("off.printWarranty"), offer.warrantyTerms],
    [t("off.printExclusions"), offer.exclusions],
  ].filter(([, value]) => value);

  return (
    <div className="offer-doc mx-auto max-w-[210mm] bg-white p-10 text-[13px] leading-relaxed text-ink">
      <div className="no-print mb-6 flex items-center justify-between rounded-lg border border-line bg-lab-porcelain p-3 text-sm">
        <span>{isDraft ? t("off.printDraftNotice") : t("off.printHint")}</span>
        <PrintButton />
      </div>

      {isDraft ? <div className="draft-mark">DRAFT</div> : null}

      <header className="flex items-start justify-between border-b-2 border-lab-burgundy pb-4">
        <img src="/brand/sarp-logo.png" alt="SARP & LAB" className="h-14 w-auto" />
        <div className="text-right text-xs">
          <div className="font-bold">SARP &amp; LAB sh.p.k.</div>
          <div>NIPT L41526502B</div>
          <div>Durrës, Shqipëri · 067 202 2609</div>
        </div>
      </header>

      <h1 className="mt-6 text-2xl font-bold">{offer.type === "WORKS" ? t("off.printTitleWorks") : t("off.printTitleProducts")}</h1>
      <table className="meta mt-3">
        <tbody>
          <tr><td>{t("off.printCode")}</td><td><strong>{offer.code}</strong></td><td>{t("off.printDate")}</td><td>{formatDate(offer.issueDate)}</td></tr>
          <tr><td>{t("off.printClient")}</td><td><strong>{offer.clientName}</strong></td><td>{t("off.printValidity")}</td><td>{t("off.printUntil", { date: formatDate(offer.validUntil) })}</td></tr>
          <tr><td>{t("off.printProject")}</td><td colSpan={offer.siteAddress ? 1 : 3}>{offer.projectName}</td>{offer.siteAddress ? <><td>{t("off.printAddress")}</td><td>{offer.siteAddress}</td></> : null}</tr>
        </tbody>
      </table>

      {offer.sections.map((section, index) => {
        const subtotal = sectionTotals(section);
        const perM2 = section.areaM2 !== null;
        return (
          <section key={section.id} className="avoid-break mt-6">
            <h2 className="text-base font-bold">
              {index + 1}. {section.title}
              {section.zone ? <span className="font-normal text-muted"> — {section.zone}</span> : null}
              {section.isOption ? <span className="ml-2 text-xs font-semibold uppercase text-lab-burgundy">{t("off.printAltOption")}</span> : null}
            </h2>
            {section.description ? <p className="mt-1 whitespace-pre-line">{section.description}</p> : null}
            <table className="items mt-2">
              <thead>
                <tr>
                  <th>{t("off.printNr")}</th>
                  <th>{t("off.colWorkItem")}</th>
                  <th>{t("off.colProduct")}</th>
                  <th>{t("common.unit")}</th>
                  <th className="num">{perM2 ? t("off.colConsumptionPerM2") : t("common.quantity")}</th>
                  <th className="num">{t("off.printPricePerUnit")}</th>
                  <th className="num">{perM2 ? t("off.colValuePerM2") : t("off.printValue")}</th>
                </tr>
              </thead>
              <tbody>
                {section.items.map((item, itemIndex) => (
                  <tr key={item.id}>
                    <td>{itemIndex + 1}</td>
                    <td>{item.description}</td>
                    <td>{item.productName || ""}</td>
                    <td>{item.unit}</td>
                    <td className="num">{item.quantity}</td>
                    <td className="num">{money(item.unitPrice)}</td>
                    <td className="num">{money(item.quantity * item.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {perM2 ? (
                  <tr><td colSpan={6}>{t("off.printValuePerM2Excl")}</td><td className="num">{money(subtotal.ratePrice)}</td></tr>
                ) : null}
                {perM2 && section.areaM2 ? (
                  <tr><td colSpan={6}>{t("off.printAreaTimes", { area: section.areaM2, rate: money(subtotal.ratePrice) })}</td><td className="num">{money(subtotal.total)}</td></tr>
                ) : null}
                {!perM2 ? <tr><td colSpan={6}>{t("off.printSectionTotal")}</td><td className="num">{money(subtotal.total)}</td></tr> : null}
              </tfoot>
            </table>
          </section>
        );
      })}

      <table className="totals avoid-break ml-auto mt-6 w-80">
        <tbody>
          <tr><td>{t("off.printSubtotal")}</td><td className="num">{money(totals.subtotal)}</td></tr>
          {totals.discount ? <tr><td>{t("off.printDiscount", { pct: offer.discountPct })}</td><td className="num">−{money(totals.discount)}</td></tr> : null}
          {totals.discount ? <tr><td>{t("off.printAfterDiscount")}</td><td className="num">{money(totals.net)}</td></tr> : null}
          <tr><td>{t("off.printVat", { rate: offer.vatRate })}</td><td className="num">{money(totals.vat)}</td></tr>
          <tr className="grand"><td>{t("off.printGrandTotal")}</td><td className="num">{money(totals.total)}</td></tr>
        </tbody>
      </table>
      {offer.sections.some((section) => section.isOption) ? (
        <p className="mt-2 text-right text-xs text-muted">{t("off.printAltNote")}</p>
      ) : null}

      {terms.length ? (
        <section className="avoid-break mt-8">
          <h2 className="text-base font-bold">{t("off.printTermsHeading")}</h2>
          <dl className="mt-2 grid gap-2">
            {terms.map(([label, value]) => (
              <div key={label}>
                <dt className="font-semibold">{label}</dt>
                <dd className="whitespace-pre-line">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <footer className="avoid-break mt-12 flex justify-between text-sm">
        <div>
          <div className="text-muted">{t("off.printForCompany")}</div>
          <div className="mt-10 border-t border-ink pt-1">{t("off.printAdminTitle")} · David Alliu</div>
        </div>
        <div>
          <div className="text-muted">{t("off.printAcceptedByClient")}</div>
          <div className="mt-10 w-56 border-t border-ink pt-1">{t("off.printNameSignatureDate")}</div>
        </div>
      </footer>
    </div>
  );
}
