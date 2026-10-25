import Link from "next/link";
import { notFound } from "next/navigation";
import { changeOfferStatus, deleteOffer, duplicateOffer } from "@/app/actions";
import { PageTitle } from "@/components/PageTitle";
import { StatCard } from "@/components/StatCard";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { offerMoney, offerTotals, sectionTotals } from "@/lib/offer-calc";
import {
  availableOfferActions,
  canApproveOffers,
  canEditOffer,
  isOfferExpired,
  offerActionLabel,
  offerStatusMeta,
  type OfferAction,
} from "@/lib/offers";
import { prisma } from "@/lib/prisma";

const actionStyle: Record<OfferAction, string> = {
  submit: "btn-primary",
  approve: "btn-save",
  request_changes: "btn-secondary",
  mark_sent: "btn-primary",
  mark_won: "btn-save",
  mark_lost: "btn-delete",
  cancel: "btn-secondary",
  reopen: "btn-secondary",
};

// Actions that take a free-text note (review feedback, lost reason).
const commentPrompt: Partial<Record<OfferAction, string>> = {
  approve: "Note for the author (optional)",
  request_changes: "What needs to change?",
  mark_lost: "Why was it lost? (price, competitor, timing…)",
};

export default async function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, offer] = await Promise.all([
    requireUser(),
    prisma.offer.findUnique({
      where: { id },
      include: {
        sections: { orderBy: { sortOrder: "asc" }, include: { items: { orderBy: { sortOrder: "asc" } } } },
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
        project: { select: { id: true, name: true } },
        events: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
      },
    }),
  ]);
  if (!offer) notFound();

  const totals = offerTotals(offer);
  const actions = availableOfferActions(user, offer);
  const meta = offerStatusMeta[offer.status];
  const expired = isOfferExpired(offer);
  const money = (value: number) => offerMoney(value, offer.currency);

  return (
    <>
      <PageTitle eyebrow={`${offer.code} · ${offer.type === "WORKS" ? "Oferta Punimeve" : "Oferta Produkteve"}`} title={offer.projectName}>
        <div className="flex flex-wrap gap-2">
          {canEditOffer(user, offer) ? <Link href={`/offers/${offer.id}/edit`} className="btn btn-secondary">Edit</Link> : null}
          <Link href={`/print/offers/${offer.id}`} className="btn btn-secondary" target="_blank">Print / PDF</Link>
          <form action={duplicateOffer}>
            <input type="hidden" name="id" value={offer.id} />
            <button className="btn btn-secondary" type="submit">Duplicate / revise</button>
          </form>
        </div>
      </PageTitle>

      <section className="panel mb-6 flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="grid gap-1 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className={meta.className}>{meta.label}</span>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{meta.albanian}</span>
            {expired ? <span className="status status-on-hold">Validity expired</span> : null}
          </div>
          <div className="mt-2"><strong>Client:</strong> {offer.clientName}{offer.siteAddress ? ` · ${offer.siteAddress}` : ""}</div>
          <div><strong>Issued:</strong> {formatDate(offer.issueDate)} · <strong>Valid until:</strong> {formatDate(offer.validUntil)}</div>
          <div>
            <strong>Prepared by:</strong> {offer.createdBy.name}
            {offer.approvedBy && offer.approvedAt ? <> · <strong>Approved by:</strong> {offer.approvedBy.name} on {formatDate(offer.approvedAt)}</> : null}
          </div>
          {offer.project ? (
            <div className="mt-2">
              <strong>Project:</strong>{" "}
              <Link href={`/projects/${offer.project.id}`} className="font-bold text-lab-burgundy underline">{offer.project.name} →</Link>
            </div>
          ) : null}
          {offer.reviewComment ? (
            <div className="mt-3 rounded-lg border border-[#ffe0a6] bg-[#fff3de] p-3 text-[#7a5414]"><strong>Review note:</strong> {offer.reviewComment}</div>
          ) : null}
          {offer.lostReason ? <div className="mt-3 rounded-lg bg-[#fdeef2] p-3 text-lab-burgundy"><strong>Lost reason:</strong> {offer.lostReason}</div> : null}
        </div>

        <div className="grid gap-3 lg:w-[380px]">
          {actions.map((action) => (
            <form key={action} action={changeOfferStatus} className="grid gap-2">
              <input type="hidden" name="id" value={offer.id} />
              <input type="hidden" name="action" value={action} />
              {commentPrompt[action] ? (
                <textarea name="comment" rows={2} placeholder={commentPrompt[action]} required={action !== "approve"} />
              ) : null}
              <button className={`btn ${actionStyle[action]}`} type="submit">{offerActionLabel(action)}</button>
            </form>
          ))}
          {offer.status === "PENDING_APPROVAL" && !canApproveOffers(user) ? (
            <div className="text-sm font-semibold text-muted">Waiting for an admin to approve this offer.</div>
          ) : null}
          {(offer.status === "DRAFT" && offer.createdById === user.id) || canApproveOffers(user) ? (
            <form action={deleteOffer}>
              <input type="hidden" name="id" value={offer.id} />
              <button className="btn btn-small btn-delete" type="submit">Delete offer</button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Net (pa TVSH)" value={money(totals.net)} detail={totals.discount ? `after ${offer.discountPct}% discount` : "before VAT"} tone="blue" />
        <StatCard label={`Total with VAT ${offer.vatRate}%`} value={money(totals.total)} detail={`VAT ${money(totals.vat)}`} />
        <StatCard label="Internal cost" value={money(totals.cost)} detail="Not shown to client" tone="amber" />
        <StatCard
          label="Margin"
          value={totals.cost > 0 ? `${totals.margin.toFixed(1)}%` : "-"}
          detail={totals.cost > 0 ? `Profit ${money(totals.profit)}` : "Add unit costs to see margin"}
          tone={totals.margin >= 25 ? "green" : totals.margin >= 10 ? "blue" : "maroon"}
        />
      </section>

      {offer.sections.map((section) => {
        const subtotal = sectionTotals(section);
        const perM2 = section.areaM2 !== null;
        return (
          <section key={section.id} className={`panel mt-6 overflow-hidden ${section.isOption ? "border-dashed" : ""}`}>
            <div className="flex flex-col gap-1 border-b border-line p-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-lab-burgundy">
                  {section.zone || "Section"}{section.isOption ? " · Alternative option (not in total)" : ""}
                </div>
                <h2 className="text-lg font-bold">{section.title}</h2>
                {section.description ? <p className="mt-1 max-w-3xl text-sm text-muted">{section.description}</p> : null}
              </div>
              <div className="text-sm font-semibold">
                {perM2 ? <>{money(subtotal.ratePrice)} / m² × {section.areaM2} m² = </> : null}
                {money(subtotal.total)}
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Zëri i punës</th>
                    <th>Produkti</th>
                    <th>Unit</th>
                    <th>{perM2 ? "Cons. / m²" : "Qty"}</th>
                    <th>Price / unit</th>
                    <th>{perM2 ? "Value / m²" : "Total"}</th>
                    <th>Cost / unit</th>
                    <th>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description}{item.kind === "LABOUR" ? <span className="ml-2 text-xs text-muted">labour</span> : null}</td>
                      <td>{item.productName || "-"}</td>
                      <td>{item.unit}</td>
                      <td>{item.quantity}</td>
                      <td>{money(item.unitPrice)}</td>
                      <td className="font-bold">{money(item.quantity * item.unitPrice)}</td>
                      <td className="text-muted">{item.unitCost ? money(item.unitCost) : "-"}</td>
                      <td className="text-muted">{item.unitCost && item.unitPrice ? `${(((item.unitPrice - item.unitCost) / item.unitPrice) * 100).toFixed(0)}%` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {offer.internalNotes ? (
        <section className="panel mt-6 p-5 text-sm"><strong>Internal notes:</strong> {offer.internalNotes}</section>
      ) : null}

      <section className="panel mt-6 p-5">
        <h2 className="mb-3 text-lg font-bold">History</h2>
        <ol className="grid gap-2 text-sm">
          {offer.events.map((event) => (
            <li key={event.id} className="flex flex-wrap gap-2">
              <span className="text-muted">{formatDate(event.createdAt)}</span>
              <strong>{event.action}</strong>
              <span>by {event.user?.name ?? "deleted user"}</span>
              {event.comment ? <span className="text-muted">— {event.comment}</span> : null}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
