import { OfferStatus, ProjectStatus, UserRole, type User } from "@prisma/client";
import { offerTotals, toEur } from "@/lib/offer-calc";
import { prisma } from "@/lib/prisma";

export const offerStatusMeta: Record<OfferStatus, { label: string; albanian: string; className: string }> = {
  DRAFT: { label: "Draft", albanian: "Draft", className: "status status-not-started" },
  PENDING_APPROVAL: { label: "Awaiting approval", albanian: "Për aprovim", className: "status status-risk" },
  READY: { label: "Ready to send", albanian: "Gati për dërgim", className: "status status-finished" },
  SENT: { label: "Sent to client", albanian: "Pending", className: "status status-finished" },
  WON: { label: "Approved by client", albanian: "Te Aprovuara", className: "status status-active" },
  LOST: { label: "Lost", albanian: "Pa Sukses", className: "status status-on-hold" },
  CANCELLED: { label: "Cancelled", albanian: "Anulluar", className: "status status-not-started" },
};

export function isOfferExpired(offer: { status: OfferStatus; validUntil: Date }) {
  return (offer.status === OfferStatus.SENT || offer.status === OfferStatus.READY) && offer.validUntil < new Date();
}

export function canApproveOffers(user: Pick<User, "role">) {
  return user.role === UserRole.ADMIN;
}

// Admins can edit anything not yet sent; others only their own drafts.
export function canEditOffer(user: Pick<User, "id" | "role">, offer: { status: OfferStatus; createdById: string }) {
  if (canApproveOffers(user)) {
    return offer.status === OfferStatus.DRAFT || offer.status === OfferStatus.PENDING_APPROVAL || offer.status === OfferStatus.READY;
  }
  return offer.status === OfferStatus.DRAFT && offer.createdById === user.id;
}

export type OfferAction = "submit" | "approve" | "request_changes" | "mark_sent" | "mark_won" | "mark_lost" | "cancel" | "reopen";

// Which actions the user may take from the offer's current status.
export function availableOfferActions(user: Pick<User, "id" | "role">, offer: { status: OfferStatus; createdById: string }): OfferAction[] {
  const admin = canApproveOffers(user);
  const owner = offer.createdById === user.id;
  switch (offer.status) {
    case OfferStatus.DRAFT:
      return admin ? ["approve", "cancel"] : owner ? ["submit", "cancel"] : [];
    case OfferStatus.PENDING_APPROVAL:
      return admin ? ["approve", "request_changes"] : [];
    case OfferStatus.READY:
      return admin ? ["mark_sent", "request_changes"] : owner ? ["mark_sent"] : [];
    case OfferStatus.SENT:
      return admin || owner ? ["mark_won", "mark_lost"] : [];
    case OfferStatus.LOST:
    case OfferStatus.CANCELLED:
      return admin ? ["reopen"] : [];
    default:
      return [];
  }
}

const transitions: Record<OfferAction, { to: OfferStatus; label: string }> = {
  submit: { to: OfferStatus.PENDING_APPROVAL, label: "Submitted for approval" },
  approve: { to: OfferStatus.READY, label: "Approved" },
  request_changes: { to: OfferStatus.DRAFT, label: "Changes requested" },
  mark_sent: { to: OfferStatus.SENT, label: "Sent to client" },
  mark_won: { to: OfferStatus.WON, label: "Approved by client" },
  mark_lost: { to: OfferStatus.LOST, label: "Marked lost" },
  cancel: { to: OfferStatus.CANCELLED, label: "Cancelled" },
  reopen: { to: OfferStatus.DRAFT, label: "Reopened" },
};

export function offerActionLabel(action: OfferAction) {
  return {
    submit: "Submit for approval",
    approve: "Approve",
    request_changes: "Request changes",
    mark_sent: "Mark sent to client",
    mark_won: "Client approved → create project",
    mark_lost: "Mark lost",
    cancel: "Cancel offer",
    reopen: "Reopen as draft",
  }[action];
}

// Next code in the yearly sequence, e.g. SARP-26-0007.
export async function nextOfferCode(date = new Date()) {
  const prefix = `SARP-${String(date.getFullYear()).slice(2)}-`;
  const last = await prisma.offer.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const lastNumber = last ? Number(last.code.slice(prefix.length)) || 0 : 0;
  return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
}

export async function transitionOffer(user: User, offerId: string, action: OfferAction, comment?: string | null) {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: { sections: { include: { items: true } } },
  });
  if (!offer) throw new Error("Offer not found.");
  if (!availableOfferActions(user, offer).includes(action)) {
    throw new Error(`You cannot "${offerActionLabel(action)}" on an offer that is ${offerStatusMeta[offer.status].label.toLowerCase()}.`);
  }
  if ((action === "submit" || action === "approve") && !offer.sections.some((section) => section.items.length)) {
    throw new Error("Add at least one line item first.");
  }

  const { to, label } = transitions[action];
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    let projectId = offer.projectId;

    if (action === "mark_won" && !projectId) {
      const totals = offerTotals(offer);
      const contractValue = toEur(totals.net, offer);
      const budget = toEur(totals.cost, offer);
      const project = await tx.project.create({
        data: {
          name: offer.projectName,
          clientName: offer.clientName,
          startDate: now,
          status: ProjectStatus.NOT_STARTED,
          budgetAmount: budget,
          estimatedContractValue: contractValue,
          estimatedProfitMargin: contractValue > 0 ? ((contractValue - budget) / contractValue) * 100 : 0,
          contractAreaM2: totals.areaM2,
        },
      });
      projectId = project.id;
    }

    const updated = await tx.offer.update({
      where: { id: offer.id },
      data: {
        status: to,
        projectId,
        ...(action === "approve" ? { approvedById: user.id, approvedAt: now, reviewComment: comment || null } : {}),
        ...(action === "request_changes" ? { approvedById: null, approvedAt: null, reviewComment: comment || null } : {}),
        ...(action === "mark_sent" ? { sentAt: now } : {}),
        ...(action === "mark_won" || action === "mark_lost" ? { decidedAt: now } : {}),
        ...(action === "mark_lost" ? { lostReason: comment || null } : {}),
        ...(action === "reopen" ? { decidedAt: null, sentAt: null, approvedById: null, approvedAt: null } : {}),
      },
    });

    await tx.offerEvent.create({
      data: { offerId: offer.id, userId: user.id, action: label, comment: comment || null },
    });

    return updated;
  });
}

export async function pendingApprovalCount() {
  try {
    return await prisma.offer.count({ where: { status: OfferStatus.PENDING_APPROVAL } });
  } catch {
    // Offer tables not created yet on this database; don't break the shell.
    return 0;
  }
}
