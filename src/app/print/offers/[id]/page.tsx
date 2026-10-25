import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { offerMoney, offerTotals, sectionTotals } from "@/lib/offer-calc";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "./PrintButton";

// Client-facing offer document. Never render unitCost, margin or internal notes here.
export default async function PrintOfferPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
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
    ["Kushtet e pagesës", offer.paymentTerms],
    [offer.type === "WORKS" ? "Afati i ekzekutimit" : "Koha e dorëzimit", offer.executionTerms],
    ["Garancia", offer.warrantyTerms],
    ["Përjashtime", offer.exclusions],
  ].filter(([, value]) => value);

  return (
    <div className="offer-doc mx-auto max-w-[210mm] bg-white p-10 text-[13px] leading-relaxed text-ink">
      <div className="no-print mb-6 flex items-center justify-between rounded-lg border border-line bg-lab-porcelain p-3 text-sm">
        <span>{isDraft ? "Draft — not yet approved for sending." : "Use your browser's print dialog and choose “Save as PDF”."}</span>
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

      <h1 className="mt-6 text-2xl font-bold">{offer.type === "WORKS" ? "Ofertë Punimesh" : "Ofertë Produktesh"}</h1>
      <table className="meta mt-3">
        <tbody>
          <tr><td>Kodi i ofertës</td><td><strong>{offer.code}</strong></td><td>Data</td><td>{formatDate(offer.issueDate)}</td></tr>
          <tr><td>Klienti</td><td><strong>{offer.clientName}</strong></td><td>Vlefshmëria</td><td>deri më {formatDate(offer.validUntil)}</td></tr>
          <tr><td>Projekti</td><td colSpan={offer.siteAddress ? 1 : 3}>{offer.projectName}</td>{offer.siteAddress ? <><td>Adresa</td><td>{offer.siteAddress}</td></> : null}</tr>
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
              {section.isOption ? <span className="ml-2 text-xs font-semibold uppercase text-lab-burgundy">Opsion alternativ</span> : null}
            </h2>
            {section.description ? <p className="mt-1 whitespace-pre-line">{section.description}</p> : null}
            <table className="items mt-2">
              <thead>
                <tr>
                  <th>Nr.</th>
                  <th>Zëri i punës</th>
                  <th>Produkti</th>
                  <th>Njësia</th>
                  <th className="num">{perM2 ? "Konsumi / m²" : "Sasia"}</th>
                  <th className="num">Çmimi / njësi (pa TVSH)</th>
                  <th className="num">{perM2 ? "Vlera / m²" : "Vlera"}</th>
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
                  <tr><td colSpan={6}>Vlera për 1 m² (pa TVSH)</td><td className="num">{money(subtotal.ratePrice)}</td></tr>
                ) : null}
                {perM2 && section.areaM2 ? (
                  <tr><td colSpan={6}>Sipërfaqja {section.areaM2} m² × {money(subtotal.ratePrice)}</td><td className="num">{money(subtotal.total)}</td></tr>
                ) : null}
                {!perM2 ? <tr><td colSpan={6}>Totali i seksionit (pa TVSH)</td><td className="num">{money(subtotal.total)}</td></tr> : null}
              </tfoot>
            </table>
          </section>
        );
      })}

      <table className="totals avoid-break ml-auto mt-6 w-80">
        <tbody>
          <tr><td>Totali (pa TVSH)</td><td className="num">{money(totals.subtotal)}</td></tr>
          {totals.discount ? <tr><td>Zbritje {offer.discountPct}%</td><td className="num">−{money(totals.discount)}</td></tr> : null}
          {totals.discount ? <tr><td>Totali pas zbritjes</td><td className="num">{money(totals.net)}</td></tr> : null}
          <tr><td>TVSH {offer.vatRate}%</td><td className="num">{money(totals.vat)}</td></tr>
          <tr className="grand"><td>TOTALI ME TVSH</td><td className="num">{money(totals.total)}</td></tr>
        </tbody>
      </table>
      {offer.sections.some((section) => section.isOption) ? (
        <p className="mt-2 text-right text-xs text-muted">Opsionet alternative nuk përfshihen në total.</p>
      ) : null}

      {terms.length ? (
        <section className="avoid-break mt-8">
          <h2 className="text-base font-bold">Kushtet</h2>
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
          <div className="text-muted">Për SARP &amp; LAB sh.p.k.</div>
          <div className="mt-10 border-t border-ink pt-1">Administratori · David Alliu</div>
        </div>
        <div>
          <div className="text-muted">Pranuar nga klienti</div>
          <div className="mt-10 w-56 border-t border-ink pt-1">Emri, firma, data</div>
        </div>
      </footer>
    </div>
  );
}
