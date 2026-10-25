// Pure offer helpers, safe to import from client components.

export const OFFER_VALIDITY_DAYS = 30;

export const DEFAULT_TERMS = {
  paymentTerms:
    "Pagesa 100% me bankë (klering). Situacione mujore sipas përqindjes së punës së kryer, pagesë brenda 15 ditësh nga data e situacionit. Materialet mbeten pronë e SARP & LAB sh.p.k. deri në pagesën e plotë.",
  executionTerms:
    "Fillimi i punimeve brenda 3 ditësh nga konfirmimi i ofertës dhe gatishmëria e objektit. Kohëzgjatja do të përcaktohet sipas grafikut të punimeve.",
  warrantyTerms:
    "Garanci 5 vjet mbi defektet e materialit dhe 2 vjet mbi cilësinë e punimit, me kusht që sipërfaqet të mos dëmtohen nga palë të treta.",
  exclusions:
    "Nuk përfshihen: skela, energjia elektrike dhe uji në objekt, pastrimi i mbetjeve jashtë objektit, punimet e paparashikuara në këtë ofertë.",
};

export const ITEM_KINDS = ["MATERIAL", "LABOUR", "OTHER"] as const;
export const ITEM_UNITS = ["m2", "ml", "kg", "lt", "m3", "cope", "thes", "kove", "sallam", "rul", "njesi"];

type ItemLike = { quantity: number; unitPrice: number; unitCost: number };
type SectionLike = { areaM2: number | null; isOption: boolean; items: ItemLike[] };
type OfferLike = { vatRate: number; discountPct: number; sections: SectionLike[] };

function sectionMultiplier(section: { areaM2: number | null }) {
  return section.areaM2 && section.areaM2 > 0 ? section.areaM2 : 1;
}

export function sectionTotals(section: SectionLike) {
  const ratePrice = section.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const rateCost = section.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const multiplier = sectionMultiplier(section);
  return {
    // Value per m2 when the section is priced per m2, otherwise equal to the total.
    ratePrice,
    rateCost,
    total: ratePrice * multiplier,
    cost: rateCost * multiplier,
  };
}

export function offerTotals(offer: OfferLike) {
  const included = offer.sections.filter((section) => !section.isOption);
  const sectionSums = included.map(sectionTotals);
  const subtotal = sectionSums.reduce((sum, section) => sum + section.total, 0);
  const cost = sectionSums.reduce((sum, section) => sum + section.cost, 0);
  const discount = subtotal * (offer.discountPct / 100);
  const net = subtotal - discount;
  const vat = net * (offer.vatRate / 100);
  return {
    subtotal,
    discount,
    net,
    vat,
    total: net + vat,
    cost,
    profit: net - cost,
    margin: net > 0 ? ((net - cost) / net) * 100 : 0,
    areaM2: included.reduce((sum, section) => sum + (section.areaM2 ?? 0), 0),
  };
}

export function toEur(value: number, offer: { currency: string; exchangeRate: number }) {
  return offer.currency === "ALL" && offer.exchangeRate > 0 ? value / offer.exchangeRate : value;
}

export function offerMoney(value: number, currency: string) {
  const formatted = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
  return `${formatted} ${currency === "ALL" ? "ALL" : "EUR"}`;
}
