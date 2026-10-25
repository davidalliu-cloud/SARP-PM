import type { Offer, OfferItem, OfferSection } from "@prisma/client";
import { dateInputValue } from "@/lib/format";
import { DEFAULT_TERMS, OFFER_VALIDITY_DAYS } from "@/lib/offer-calc";
import { prisma } from "@/lib/prisma";
import type { OfferEditorValues } from "./OfferEditor";

export function blankOfferValues(): OfferEditorValues {
  const issueDate = new Date();
  const validUntil = new Date(issueDate);
  validUntil.setDate(validUntil.getDate() + OFFER_VALIDITY_DAYS);
  return {
    type: "WORKS",
    clientName: "",
    projectName: "",
    siteAddress: "",
    issueDate: dateInputValue(issueDate),
    validUntil: dateInputValue(validUntil),
    currency: "EUR",
    exchangeRate: 100,
    vatRate: 20,
    discountPct: 0,
    ...DEFAULT_TERMS,
    internalNotes: "",
    sections: [],
  };
}

export function offerToEditorValues(offer: Offer & { sections: (OfferSection & { items: OfferItem[] })[] }): OfferEditorValues {
  return {
    id: offer.id,
    type: offer.type,
    clientName: offer.clientName,
    projectName: offer.projectName,
    siteAddress: offer.siteAddress ?? "",
    issueDate: dateInputValue(offer.issueDate),
    validUntil: dateInputValue(offer.validUntil),
    currency: offer.currency === "ALL" ? "ALL" : "EUR",
    exchangeRate: offer.exchangeRate,
    vatRate: offer.vatRate,
    discountPct: offer.discountPct,
    paymentTerms: offer.paymentTerms ?? "",
    executionTerms: offer.executionTerms ?? "",
    warrantyTerms: offer.warrantyTerms ?? "",
    exclusions: offer.exclusions ?? "",
    internalNotes: offer.internalNotes ?? "",
    sections: offer.sections.map((section) => ({
      title: section.title,
      zone: section.zone ?? "",
      description: section.description ?? "",
      areaM2: section.areaM2,
      isOption: section.isOption,
      items: section.items.map((item) => ({
        kind: item.kind,
        description: item.description,
        productName: item.productName ?? "",
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
      })),
    })),
  };
}

export function offerProductOptions() {
  return prisma.product.findMany({
    select: { name: true, unit: true, defaultCostPerUnit: true },
    orderBy: { name: "asc" },
  });
}
