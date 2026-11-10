// Curated set of SARP waterproofing systems offered at offer-section level.
// Distilled from the Mapei "Analisi dei Prezzi" (too granular to use raw) plus
// SARP's own catalogue. Picking a system in the "Sistemi" dropdown fills the
// client-facing section description (Përshkrimi për klientin); the field stays
// editable afterwards. The dropdown is a combobox — a custom system can still
// be typed, in which case no description is auto-filled. List approved by David.

export type OfferSystem = {
  key: string;
  /** Dropdown label (Albanian) — also the section title that gets set. */
  label: string;
  /** Client-facing section description filled in when this system is picked. */
  clientDescription: string;
};

export const OFFER_SYSTEMS: OfferSystem[] = [
  {
    key: "mapelastic",
    label: "Hidroizolim me Mapelastic",
    clientDescription:
      "Hidroizolim i sipërfaqes me llaç çimentor bikomponent elastik (tip Mapei Mapelastic), i aplikuar në dy duar me mistri ose rul. Krijon një shtresë të vazhdueshme, elastike dhe plotësisht të papërshkueshme nga uji, ideale për taraca, banja, themele dhe struktura në kontakt me ujin. Përfshin përgatitjen e sipërfaqes dhe trajtimin e këndeve.",
  },
  {
    key: "mapelastic-rrjete",
    label: "Hidroizolim me Mapelastic + rrjetë",
    clientDescription:
      "Hidroizolim me llaç çimentor bikomponent elastik (tip Mapei Mapelastic), i armuar me rrjetë përforcuese (Mapenet/Mapetex) në të gjithë sipërfaqen ose në pikat kritike. Rrjeta rrit kapërcimin e çarjeve dhe qëndrueshmërinë mekanike, duke garantuar një hidroizolim të vazhdueshëm e të besueshëm për taraca dhe struktura të ekspozuara ndaj lëvizjeve.",
  },
  {
    key: "mapelastic-smart",
    label: "Hidroizolim me Mapelastic Smart",
    clientDescription:
      "Hidroizolim me llaç çimentor bikomponent me elasticitet shumë të lartë (tip Mapei Mapelastic Smart), me aftësi kapërcimi çarjesh mbi 2 mm. I përshtatshëm për sipërfaqe me mikroçarje ose lëvizje — taraca, ballkone, pishina dhe depozita uji — i aplikuar me rul ose spërkatje në dy duar.",
  },
  {
    key: "aquaflex",
    label: "Hidroizolim me membranë të lëngshme Aquaflex",
    clientDescription:
      "Hidroizolim me membranë të lëngshme akrilike elastomerike (tip Mapei Aquaflex Roof), e aplikuar e ftohtë me rul ose furçë në disa duar, e përforcuar me pëlhurë ku nevojitet. Formon një shtresë të vazhdueshme, pa bashkime, me rezistencë ndaj rrezeve UV dhe qëndrimit të ujit — ideale për taraca e çati të ekspozuara.",
  },
  {
    key: "purtop",
    label: "Hidroizolim me Purtop",
    clientDescription:
      "Hidroizolim me membranë të lëngshme poliuretanike (tip Mapei Purtop), e aplikuar në vend, elastike dhe pa bashkime. Krijon një shtresë monolite tërësisht të papërshkueshme nga uji, me rezistencë të lartë ndaj UV-ve dhe ngarkesave, e përshtatshme për taraca, taraca të ecshme dhe struktura në kontakt të vazhdueshëm me ujin.",
  },
  {
    key: "mapeplan",
    label: "Hidroizolim me membranë sintetike Mapeplan",
    clientDescription:
      "Hidroizolim me membranë sintetike të parapërgatitur PVC/TPO (tip Mapei Mapeplan), e salduar në nyje me ajër të nxehtë për një sistem plotësisht të papërshkueshëm. E qëndrueshme, me jetëgjatësi të lartë dhe rezistencë ndaj rrezeve UV, e përshtatshme për çati, taraca dhe hidroizolim nëntoke.",
  },
  {
    key: "mapeproof",
    label: "Hidroizolim i themeleve me Mapeproof",
    clientDescription:
      "Hidroizolim i themeleve dhe strukturave nëntokësore me membranë bentonitike aktive (tip Mapei Mapeproof). Në kontakt me ujin, bentoniti fryhet dhe vetëmbyll çarjet e vogla, duke garantuar mbrojtje afatgjatë nga uji nën presion për mure mbajtëse, themele dhe bodrume.",
  },
  {
    key: "idrostop",
    label: "Water-stop për fuga pune me Idrostop",
    clientDescription:
      "Ndalues uji (water-stop) në fugat e punës së betonit me profil hidrofryerës ose PVC (tip Mapei Idrostop). Parandalon depërtimin e ujit nëpër fugat e betonimit te themelet, muret mbajtëse dhe rezervuarët.",
  },
  {
    key: "mapeband",
    label: "Trajtim detajesh me brez Mapeband",
    clientDescription:
      "Trajtim i detajeve kritike (kënde, fuga lëvizëse, kalime tubash) me brez elastik hidroizolues (tip Mapei Mapeband), i ngjitur me llaç ose ngjitës të përshtatshëm. Siguron vazhdimësinë e hidroizolimit në pikat më të ekspozuara ndaj infiltrimeve.",
  },
  {
    key: "osmotik",
    label: "Hidroizolim osmotik/kristalizues",
    clientDescription:
      "Hidroizolim osmotik me llaç kristalizues (tip Mapei Idrosilex/Lamposilex ose ekuivalent), i cili depërton në poret e betonit dhe formon kristale që bllokojnë kalimin e ujit. I përshtatshëm për struktura nën presion hidraulik — rezervuarë, bodrume, puseta dhe mure mbajtëse.",
  },
  {
    key: "elastocolor",
    label: "Veshje elastomerike fasade me Elastocolor",
    clientDescription:
      "Veshje mbrojtëse elastomerike për fasada (tip Mapei Elastocolor), me elasticitet të lartë dhe rezistencë ndaj motit, që kapërcen mikroçarjet dhe mbron suvanë nga infiltrimet e ujit e nga karbonatizimi. Aplikohet në disa duar mbi primerin përkatës.",
  },
];

/** Zone suggestions for the "Zona" combobox (free text still allowed). */
export const OFFER_ZONES: string[] = [
  "Tarracë",
  "Çati",
  "Themele",
  "Bodrum",
  "Banjo/Tualet",
  "Ballkon",
  "Pishinë",
  "Depozitë uji",
  "Parking/Garazh",
  "Fasadë",
  "Mure mbajtëse",
  "Kanale/Hauz",
];

/** The system whose label matches this section title (e.g. when picked from the list). */
export function systemForLabel(label: string): OfferSystem | undefined {
  const text = label.trim().toLowerCase();
  if (!text) return undefined;
  return OFFER_SYSTEMS.find((system) => system.label.toLowerCase() === text);
}
