import Link from "next/link";
import { OfferStatus } from "@prisma/client";
import { PageTitle } from "@/components/PageTitle";
import { StatCard } from "@/components/StatCard";
import { requireUser } from "@/lib/auth";
import { formatDate, money } from "@/lib/format";
import { offerMoney, offerTotals, toEur } from "@/lib/offer-calc";
import { canApproveOffers, isOfferExpired, offerStatusMeta } from "@/lib/offers";
import { prisma } from "@/lib/prisma";

const tabs: { key: string; label: string; statuses: OfferStatus[] }[] = [
  { key: "open", label: "Open", statuses: [OfferStatus.DRAFT, OfferStatus.PENDING_APPROVAL, OfferStatus.READY, OfferStatus.SENT] },
  { key: "approval", label: "Awaiting approval", statuses: [OfferStatus.PENDING_APPROVAL] },
  { key: "sent", label: "Sent (Pending)", statuses: [OfferStatus.SENT] },
  { key: "won", label: "Approved (Te Aprovuara)", statuses: [OfferStatus.WON] },
  { key: "lost", label: "Lost (Pa Sukses)", statuses: [OfferStatus.LOST, OfferStatus.CANCELLED] },
  { key: "all", label: "All", statuses: Object.values(OfferStatus) },
];

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "open" } = await searchParams;
  const user = await requireUser();
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
      <PageTitle eyebrow="Sales" title="Offers">
        <Link href="/offers/new" className="btn btn-primary">New offer</Link>
      </PageTitle>

      {approvalCount && canApproveOffers(user) ? (
        <Link href="/offers?tab=approval" className="mb-6 block rounded-xl border border-[#ffe0a6] bg-[#fff3de] p-4 text-sm font-semibold text-[#a9761b]">
          {approvalCount} {approvalCount === 1 ? "offer is" : "offers are"} waiting for your approval →
        </Link>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting approval" value={approvalCount} detail="Internal review" tone={approvalCount ? "amber" : "default"} />
        <StatCard label="Sent pipeline" value={money(sum(OfferStatus.SENT))} detail={`${count(OfferStatus.SENT)} offers with clients`} tone="blue" />
        <StatCard label="Approved by clients" value={money(sum(OfferStatus.WON))} detail={`${count(OfferStatus.WON)} offers won`} tone="green" />
        <StatCard label="Win rate" value={`${winRate.toFixed(0)}%`} detail={`${decided} decided offers`} tone={winRate >= 30 ? "green" : "maroon"} />
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
            {item.label}
          </Link>
        ))}
      </nav>

      <section className="panel mt-4 overflow-hidden">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Code</th>
                <th>Client / project</th>
                <th>Type</th>
                <th>Issued</th>
                <th>Valid until</th>
                <th>Net value</th>
                <th>Margin</th>
                <th>Prepared by</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ offer, totals, expired }) => (
                <tr key={offer.id}>
                  <td>
                    <span className={offerStatusMeta[offer.status].className}>{offerStatusMeta[offer.status].label}</span>
                    {expired ? <span className="status status-on-hold ml-1">Expired</span> : null}
                  </td>
                  <td><Link href={`/offers/${offer.id}`} className="font-bold text-ink underline-offset-2 hover:underline">{offer.code}</Link></td>
                  <td>
                    <Link href={`/offers/${offer.id}`} className="font-bold text-ink">{offer.projectName}</Link>
                    <div className="mt-1 text-xs font-semibold text-muted">{offer.clientName}</div>
                  </td>
                  <td>{offer.type === "WORKS" ? "Works" : "Products"}</td>
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
        {!visible.length ? <div className="p-5 text-sm font-bold text-muted">No offers in this view.</div> : null}
      </section>
    </>
  );
}
