import Link from "next/link";
import { OfferStatus } from "@prisma/client";
import { PageTitle } from "@/components/PageTitle";
import { StatCard } from "@/components/StatCard";
import { requireUser } from "@/lib/auth";
import { formatDate, money } from "@/lib/format";
import { offerMoney, offerTotals, toEur } from "@/lib/offer-calc";
import { canApproveOffers, isOfferExpired, offerStatusMeta } from "@/lib/offers";
import { setupOfferTables } from "@/app/actions";
import { offerTablesExist } from "@/lib/offer-setup";
import { getT } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";

const tabs: { key: string; labelKey: string; statuses: OfferStatus[] }[] = [
  { key: "open", labelKey: "off.tabOpen", statuses: [OfferStatus.DRAFT, OfferStatus.PENDING_APPROVAL, OfferStatus.READY, OfferStatus.SENT] },
  { key: "approval", labelKey: "off.tabApproval", statuses: [OfferStatus.PENDING_APPROVAL] },
  { key: "sent", labelKey: "off.tabSent", statuses: [OfferStatus.SENT] },
  { key: "won", labelKey: "off.tabWon", statuses: [OfferStatus.WON] },
  { key: "lost", labelKey: "off.tabLost", statuses: [OfferStatus.LOST, OfferStatus.CANCELLED] },
  { key: "all", labelKey: "off.tabAll", statuses: Object.values(OfferStatus) },
];

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "open" } = await searchParams;
  const user = await requireUser();
  const t = await getT();

  if (!(await offerTablesExist())) {
    return (
      <>
        <PageTitle eyebrow={t("off.eyebrowSales")} title={t("off.title")} />
        <section className="panel max-w-2xl p-5">
          <h2 className="text-lg font-bold">{t("off.setupTitle")}</h2>
          {canApproveOffers(user) ? (
            <form action={setupOfferTables} className="mt-3 grid gap-3">
              <p className="text-sm text-muted">
                {t("off.setupText")}
              </p>
              <button className="btn btn-primary w-fit" type="submit">{t("off.setupButton")}</button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-muted">{t("off.setupAskAdmin")}</p>
          )}
        </section>
      </>
    );
  }

  const offers = await prisma.offer.findMany({
    include: { sections: { include: { items: true } }, createdBy: { select: { name: true } } },
    orderBy: [{ issueDate: "desc" }, { code: "desc" }],
  });

  const rows = offers.map((offer) => {
    const totals = offerTotals(offer);
    return { offer, totals, netEur: toEur(totals.net, offer), expired: isOfferExpired(offer) };
  });
  const sum = (status: OfferStatus) => rows.filter((row) => row.offer.status === status).reduce((total, row) => total + row.netEur, 0);
  const count = (status: OfferStatus) => rows.filter((row) => row.offer.status === status).length;
  const decided = count(OfferStatus.WON) + count(OfferStatus.LOST);
  const winRate = decided ? (count(OfferStatus.WON) / decided) * 100 : 0;

  const activeTab = tabs.find((item) => item.key === tab) ?? tabs[0];
  const visible = rows.filter((row) => activeTab.statuses.includes(row.offer.status));
  const approvalCount = count(OfferStatus.PENDING_APPROVAL);

  return (
    <>
      <PageTitle eyebrow={t("off.eyebrowSales")} title={t("off.title")}>
        <Link href="/offers/new" className="btn btn-primary">{t("off.newOffer")}</Link>
      </PageTitle>

      {approvalCount && canApproveOffers(user) ? (
        <Link href="/offers?tab=approval" className="mb-6 block rounded-xl border border-[#ffe0a6] bg-[#fff3de] p-4 text-sm font-semibold text-[#a9761b]">
          {t(approvalCount === 1 ? "off.approvalBannerOne" : "off.approvalBannerMany", { count: approvalCount })}
        </Link>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("off.statAwaiting")} value={approvalCount} detail={t("off.statAwaitingDetail")} tone={approvalCount ? "amber" : "default"} />
        <StatCard label={t("off.statSentPipeline")} value={money(sum(OfferStatus.SENT))} detail={t(count(OfferStatus.SENT) === 1 ? "off.statSentPipelineDetailOne" : "off.statSentPipelineDetailMany", { count: count(OfferStatus.SENT) })} tone="blue" />
        <StatCard label={t("off.statApprovedClients")} value={money(sum(OfferStatus.WON))} detail={t(count(OfferStatus.WON) === 1 ? "off.statApprovedClientsDetailOne" : "off.statApprovedClientsDetailMany", { count: count(OfferStatus.WON) })} tone="green" />
        <StatCard label={t("off.statWinRate")} value={`${winRate.toFixed(0)}%`} detail={t(decided === 1 ? "off.statWinRateDetailOne" : "off.statWinRateDetailMany", { count: decided })} tone={winRate >= 30 ? "green" : "maroon"} />
      </section>

      <nav className="mt-6 flex gap-1 overflow-x-auto">
        {tabs.map((item) => (
          <Link
            key={item.key}
            href={`/offers?tab=${item.key}`}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition ${
              item.key === activeTab.key ? "bg-lab-burgundy text-white" : "text-ink hover:bg-lab-burgundy/5 hover:text-lab-burgundy"
            }`}
          >
            {t(item.labelKey)}
          </Link>
        ))}
      </nav>

      <section className="panel mt-4 overflow-hidden">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("common.status")}</th>
                <th>{t("off.colCode")}</th>
                <th>{t("off.colClientProject")}</th>
                <th>{t("off.colType")}</th>
                <th>{t("off.colIssued")}</th>
                <th>{t("off.colValidUntil")}</th>
                <th>{t("off.colNetValue")}</th>
                <th>{t("off.colMargin")}</th>
                <th>{t("off.colPreparedBy")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ offer, totals, expired }) => (
                <tr key={offer.id}>
                  <td>
                    <span className={offerStatusMeta[offer.status].className}>{t(`off.status.${offer.status}`)}</span>
                    {expired ? <span className="status status-on-hold ml-1">{t("off.expired")}</span> : null}
                  </td>
                  <td><Link href={`/offers/${offer.id}`} className="font-bold text-ink underline-offset-2 hover:underline">{offer.code}</Link></td>
                  <td>
                    <Link href={`/offers/${offer.id}`} className="font-bold text-ink">{offer.projectName}</Link>
                    <div className="mt-1 text-xs font-semibold text-muted">{offer.clientName}</div>
                  </td>
                  <td>{offer.type === "WORKS" ? t("off.typeWorksShort") : t("off.typeProductsShort")}</td>
                  <td>{formatDate(offer.issueDate)}</td>
                  <td className={expired ? "font-bold text-lab-burgundy" : ""}>{formatDate(offer.validUntil)}</td>
                  <td className="font-bold">{offerMoney(totals.net, offer.currency)}</td>
                  <td>{totals.cost > 0 ? `${totals.margin.toFixed(1)}%` : "-"}</td>
                  <td>{offer.createdBy.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length ? <div className="p-5 text-sm font-bold text-muted">{t("off.noneInView")}</div> : null}
      </section>
    </>
  );
}
