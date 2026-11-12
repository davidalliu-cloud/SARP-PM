import Link from "next/link";
import { notFound } from "next/navigation";
import { changeOfferStatus, duplicateOffer } from "@/app/actions";
import { DeleteOfferButton } from "@/components/DeleteOfferButton";
import { PageTitle } from "@/components/PageTitle";
import { StatCard } from "@/components/StatCard";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { offerMoney, offerTotals, sectionTotals } from "@/lib/offer-calc";
import {
  availableOfferActions,
  canApproveOffers,
  canEditOffer,
  isOfferExpired,
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
const commentPromptKey: Partial<Record<OfferAction, string>> = {
  approve: "off.comment.approve",
  request_changes: "off.comment.request_changes",
  mark_lost: "off.comment.mark_lost",
};

export default async function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getT();
  const [user, offer, projects] = await Promise.all([
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
    // For "client approved" → attach to an existing project instead of
    // always creating a new one (a change order / added scope).
    prisma.project.findMany({ select: { id: true, name: true, clientName: true }, orderBy: { name: "asc" } }),
  ]);
  if (!offer) notFound();

  // Same-client projects first, so the likely target is easy to find.
  const projectOptions = [...projects].sort((a, b) => {
    const aMatch = a.clientName === offer.clientName ? 0 : 1;
    const bMatch = b.clientName === offer.clientName ? 0 : 1;
    return aMatch - bMatch || a.name.localeCompare(b.name);
  });

  const totals = offerTotals(offer);
  const actions = availableOfferActions(user, offer);
  const meta = offerStatusMeta[offer.status];
  const expired = isOfferExpired(offer);
  const money = (value: number) => offerMoney(value, offer.currency);

  return (
    <>
      <PageTitle eyebrow={`${offer.code} · ${offer.type === "WORKS" ? t("off.typeWorksName") : t("off.typeProductsName")}`} title={offer.projectName}>
        <div className="flex flex-wrap gap-2">
          {canEditOffer(user, offer) ? <Link href={`/offers/${offer.id}/edit`} className="btn btn-secondary">{t("common.edit")}</Link> : null}
          <Link href={`/print/offers/${offer.id}`} className="btn btn-secondary" target="_blank">{t("off.printPdf")}</Link>
          <form action={duplicateOffer}>
            <input type="hidden" name="id" value={offer.id} />
            <button className="btn btn-secondary" type="submit">{t("off.duplicate")}</button>
          </form>
        </div>
      </PageTitle>

      <section className="panel mb-6 flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="grid gap-1 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className={meta.className}>{t(`off.status.${offer.status}`)}</span>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t(`off.statusSub.${offer.status}`)}</span>
            {expired ? <span className="status status-on-hold">{t("off.validityExpired")}</span> : null}
          </div>
          <div className="mt-2"><strong>{t("off.metaClient")}:</strong> {offer.clientName}{offer.siteAddress ? ` · ${offer.siteAddress}` : ""}</div>
          <div><strong>{t("off.metaIssued")}:</strong> {formatDate(offer.issueDate)} · <strong>{t("off.metaValidUntil")}:</strong> {formatDate(offer.validUntil)}</div>
          <div>
            <strong>{t("off.metaPreparedBy")}:</strong> {offer.createdBy.name}
            {offer.approvedBy && offer.approvedAt ? <> · <strong>{t("off.metaApprovedBy")}:</strong> {offer.approvedBy.name} {t("off.onConnector")} {formatDate(offer.approvedAt)}</> : null}
          </div>
          {offer.project ? (
            <div className="mt-2">
              <strong>{t("off.metaProject")}:</strong>{" "}
              <Link href={`/projects/${offer.project.id}`} className="font-bold text-lab-burgundy underline">{offer.project.name} →</Link>
            </div>
          ) : null}
          {offer.reviewComment ? (
            <div className="mt-3 rounded-lg border border-[#ffe0a6] bg-[#fff3de] p-3 text-[#7a5414]"><strong>{t("off.reviewNote")}:</strong> {offer.reviewComment}</div>
          ) : null}
          {offer.lostReason ? <div className="mt-3 rounded-lg bg-[#fdeef2] p-3 text-lab-burgundy"><strong>{t("off.lostReasonLabel")}:</strong> {offer.lostReason}</div> : null}
        </div>

        <div className="grid gap-3 lg:w-[380px]">
          {actions.map((action) => (
            <form key={action} action={changeOfferStatus} className="grid gap-2">
              <input type="hidden" name="id" value={offer.id} />
              <input type="hidden" name="action" value={action} />
              {commentPromptKey[action] ? (
                <textarea name="comment" rows={2} placeholder={t(commentPromptKey[action]!)} required={action !== "approve"} />
              ) : null}
              {action === "mark_won" && !offer.projectId ? (
                <select name="targetProjectId" defaultValue="">
                  <option value="">{t("off.createNewProjectOption")}</option>
                  {projectOptions.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}{project.clientName ? ` — ${project.clientName}` : ""}
                    </option>
                  ))}
                </select>
              ) : null}
              <button className={`btn ${actionStyle[action]}`} type="submit">{t(`off.action.${action}`)}</button>
            </form>
          ))}
          {offer.status === "PENDING_APPROVAL" && !canApproveOffers(user) ? (
            <div className="text-sm font-semibold text-muted">{t("off.waitingAdminApprove")}</div>
          ) : null}
          {(offer.status === "DRAFT" && offer.createdById === user.id) || canApproveOffers(user) ? (
            <DeleteOfferButton id={offer.id} code={offer.code} label={t("off.deleteOffer")} />
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("off.statNet")} value={money(totals.net)} detail={totals.discount ? t("off.afterDiscount", { pct: offer.discountPct }) : t("off.beforeVat")} tone="blue" />
        <StatCard label={t("off.statTotalWithVat", { rate: offer.vatRate })} value={money(totals.total)} detail={t("off.vatAmount", { amount: money(totals.vat) })} />
        <StatCard label={t("off.statInternalCost")} value={money(totals.cost)} detail={t("off.notShownToClient")} tone="amber" />
        <StatCard
          label={t("off.statMargin")}
          value={totals.cost > 0 ? `${totals.margin.toFixed(1)}%` : "-"}
          detail={totals.cost > 0 ? t("off.profitAmount", { amount: money(totals.profit) }) : t("off.addUnitCosts")}
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
                  {section.zone || t("off.sectionFallback")}{section.isOption ? ` · ${t("off.altOptionNotInTotal")}` : ""}
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
                    <th>{t("off.colWorkItem")}</th>
                    <th>{t("off.colProduct")}</th>
                    <th>{t("common.unit")}</th>
                    <th>{perM2 ? t("off.colConsPerM2") : t("off.colQty")}</th>
                    <th>{t("off.colPricePerUnit")}</th>
                    <th>{perM2 ? t("off.colValuePerM2") : t("common.total")}</th>
                    <th>{t("off.colCostPerUnit")}</th>
                    <th>{t("off.colMargin")}</th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description}{item.kind === "LABOUR" ? <span className="ml-2 text-xs text-muted">{t("off.labourTag")}</span> : null}</td>
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

      {offer.techDescription ? (
        <section className="panel mt-6 p-5">
          <h2 className="mb-2 text-lg font-bold">{t("off.techHeader")}</h2>
          <p className="whitespace-pre-line text-sm text-ink">{offer.techDescription}</p>
        </section>
      ) : null}

      {offer.internalNotes ? (
        <section className="panel mt-6 p-5 text-sm"><strong>{t("off.internalNotesLabel")}:</strong> {offer.internalNotes}</section>
      ) : null}

      <section className="panel mt-6 p-5">
        <h2 className="mb-3 text-lg font-bold">{t("off.history")}</h2>
        <ol className="grid gap-2 text-sm">
          {offer.events.map((event) => (
            <li key={event.id} className="flex flex-wrap gap-2">
              <span className="text-muted">{formatDate(event.createdAt)}</span>
              <strong>{event.action}</strong>
              <span>{t("off.byUser", { name: event.user?.name ?? t("off.deletedUser") })}</span>
              {event.comment ? <span className="text-muted">— {event.comment}</span> : null}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
