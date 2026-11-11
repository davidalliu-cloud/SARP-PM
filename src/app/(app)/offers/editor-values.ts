import type { Offer, OfferItem, OfferSection } from "@prisma/client";
import { dateInputValue } from "@/lib/format";
import { DEFAULT_TERMS, OFFER_VALIDITY_DAYS } from "@/lib/offer-calc";
import { DEFAULT_OFFER_PARAMS, resolveOfferParams } from "@/lib/offer-costing";
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
    // New offers default to EUR, so the day-rate/equipment defaults (kept in Lek
    // on DEFAULT_OFFER_PARAMS) are scaled to euros at the default 100 rate.
    params: { ...DEFAULT_OFFER_PARAMS, dailyRateAll: 70, equipmentPerDayAll: 25 },
    ...DEFAULT_TERMS,
    internalNotes: "",
    techDescription: "",
    sections: [],
  };
}

export function offerToEditorValues(offer: Offer & { sections: (OfferSection & { items: OfferItem[] })[] }): OfferEditorValues {
  const currency = offer.currency === "ALL" ? "ALL" : "EUR";
  const params = resolveOfferParams(offer.params);
  // Back-compat: the day-rate/equipment used to be stored in Lek regardless of
  // offer currency. They are now in the offer currency, so a EUR offer saved
  // under the old model carries a Lek-scale figure (e.g. 7000). Detect that by
  // magnitude (a real EUR day-rate is small) and convert it down to euros.
  if (currency === "EUR" && params.dailyRateAll > 1000) {
    const rate = offer.exchangeRate > 0 ? offer.exchangeRate : 100;
    params.dailyRateAll = Math.round((params.dailyRateAll / rate) * 100) / 100;
    params.equipmentPerDayAll = Math.round((params.equipmentPerDayAll / rate) * 100) / 100;
  }
  return {
    id: offer.id,
    type: offer.type,
    clientName: offer.clientName,
    projectName: offer.projectName,
    siteAddress: offer.siteAddress ?? "",
    issueDate: dateInputValue(offer.issueDate),
    validUntil: dateInputValue(offer.validUntil),
    currency,
    exchangeRate: offer.exchangeRate,
    vatRate: offer.vatRate,
    discountPct: offer.discountPct,
    params,
    techDescription: offer.techDescription ?? "",
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
      yieldM2PerDay: section.yieldM2PerDay ?? null,
      teamSize: section.teamSize ?? null,
      items: section.items.map((item) => ({
        kind: item.kind,
        description: item.description,
        productName: item.productName ?? "",
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        manualPrice: item.manualPrice ?? false,
        fixedCost: item.fixedCost ?? false,
      })),
    })),
  };
}

export function offerProductOptions() {
  return prisma.product.findMany({
    select: {
      name: true,
      unit: true,
      defaultCostPerUnit: true,
      baseUnit: true,
      consumptionPerM2: true,
      consumptionBasis: true,
      supplierPriceAll: true,
      priceEur: true,
      workItem: true,
      techDescription: true,
      labourManHoursPerM2: true,
      labourWorkers: true,
    },
    orderBy: { name: "asc" },
  });
}

/** Distinct client names already in the system (projects, invoices, offers), for the offer client picker. */
export async function offerClientOptions(): Promise<string[]> {
  const [projects, invoices, offers] = await Promise.all([
    prisma.project.findMany({ select: { clientName: true }, distinct: ["clientName"] }),
    prisma.invoice.findMany({ select: { clientName: true }, distinct: ["clientName"] }),
    prisma.offer.findMany({ select: { clientName: true }, distinct: ["clientName"] }),
  ]);
  const names = new Set<string>();
  for (const row of [...projects, ...invoices, ...offers]) {
    const name = row.clientName?.trim();
    if (name) names.add(name);
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}
