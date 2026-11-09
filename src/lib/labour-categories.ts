// Fixed set of labour ("Punetoria") work categories offered on offer lines.
// Picking one on a LABOUR line fills the unit (always m²), the client-facing
// line description, and contributes a technical paragraph to the offer's
// Technical Description. Content approved by David (SARP & LAB) — editable in
// the editor after it is filled in. Pricing is unchanged (team/day parameters
// or the manual override), so no DB column is needed for this.

export type LabourCategory = {
  key: string;
  /** Dropdown label (Albanian, as given). */
  label: string;
  /** Unit for the line — all five are measured per m². */
  unit: string;
  /** Short line text shown to the client ("Zëri i Punës"). */
  clientDescription: string;
  /** Technical paragraph appended to the offer's Technical Description. */
  techDescription: string;
};

export const LABOUR_CATEGORIES: LabourCategory[] = [
  {
    key: "rrashinim",
    label: "Rrashinim",
    unit: "m2",
    clientDescription:
      "Rrashinim mekanik i sipërfaqes së betonit për heqjen e qumështit të çimentos, suvatimeve të dobëta dhe shtresave të vjetra, duke krijuar një bazament të shëndoshë e me ashpërsi të përshtatshme për ngjitje.",
    techDescription:
      "Përgatitje mekanike e sipërfaqes nëpërmjet rrashinimit/frezimit me makineri diamantore ose koka çeliku, deri në një bazament kompakt, pa pjesë të shkrifta, pa qumësht çimentoje dhe me profil ashpërsie të hapur (CSP), për thithje e kapje optimale të primerit/izolimit sipas skedave teknike. Pluhuri hiqet me aspirim industrial.",
  },
  {
    key: "pastrim",
    label: "Pastrim",
    unit: "m2",
    clientDescription:
      "Pastrim i plotë i sipërfaqes nga pluhuri, papastërtitë, yndyrat dhe pjesët e shkrifta, për një bazë të pastër përpara aplikimit të sistemit izolues.",
    techDescription:
      "Pastrim nëpërmjet fshesimit, aspirimit industrial dhe, kur nevojitet, larjes me ujë nën presion, për heqjen e pluhurit, baltës dhe yndyrave. Sipërfaqja lihet e thatë e pa papastërti përpara aplikimit të primerit, sipas kërkesave të skedave teknike.",
  },
  {
    key: "izolim-poliuretan",
    label: "Izolim me Poliuretan",
    unit: "m2",
    clientDescription:
      "Hidroizolim me membranë të lëngshme poliuretanike, e aplikuar në vend, elastike dhe pa bashkime, që krijon një shtresë monolite tërësisht të papërshkueshme nga uji.",
    techDescription:
      "Hidroizolim me rrëshirë poliuretanike të lëngshme (tip Mapei Purtop / Purtop Easy ose ekuivalent), aplikuar me rul/furçë ose spërkatje në dy duar mbi bazamentin e primeruar, me konsum sipas skedës teknike. Formon membranë elastike, pa bashkime, me kapërcim çarjesh dhe rezistencë ndaj UV-ve (për versionet e ekspozuara), e përshtatshme për taraca, mbulesa e struktura në kontakt me ujin. Përfshin trajtimin e këndeve e detajeve me brez përforcues.",
  },
  {
    key: "izolim-bikomponent",
    label: "Izolim me Material Bi-komponent",
    unit: "m2",
    clientDescription:
      "Hidroizolim me llaç çimentor bikomponent elastik, i aplikuar me mistri/rul ose spërkatje, ideal për sipërfaqe të ekspozuara ndaj ujit dhe shtypjes hidraulike.",
    techDescription:
      "Hidroizolim me llaç çimentor bikomponent elastik (tip Mapei Mapelastic / Mapelastic Smart / Mapelastic Foundation ose ekuivalent), me bazë lidhësish çimentorë, agregate të përzgjedhur, fibra e polimere sintetike në dispersion ujor. Aplikohet në dy duar (~1.7 kg/m² për mm trashësi), i armuar me rrjetë (tip Mapenet 150 / Mapetex) në pikat kritike, me kapërcim çarjesh. I përshtatshëm për taraca, banja, pishina, themele e struktura nën shtypje hidraulike, sipas skedave teknike Mapei.",
  },
  {
    key: "izolim-membrane-lengshme",
    label: "Izolim me Membrane të Lëngshme",
    unit: "m2",
    clientDescription:
      "Hidroizolim me membranë të lëngshme elastomerike, e aplikuar e ftohtë dhe pa bashkime, që i përshtatet çdo forme të sipërfaqes.",
    techDescription:
      "Hidroizolim me membranë të lëngshme elastomerike (tip Mapei Aquaflex / Aquaflex Roof ose ekuivalent), aplikuar e ftohtë me rul/furçë ose spërkatje në disa duar, e përforcuar me pëlhurë poliestri/fibër xhami ku nevojitet. Krijon shtresë të vazhdueshme, elastike e pa bashkime, me rezistencë ndaj UV-ve dhe qëndrimit të ujit, kryesisht për taraca e mbulesa. Konsumi dhe numri i duarve sipas skedës teknike.",
  },
];

/** The category whose client description matches this line's text, if any. */
export function labourCategoryForDescription(description: string): LabourCategory | undefined {
  const text = description.trim();
  if (!text) return undefined;
  return LABOUR_CATEGORIES.find((category) => category.clientDescription === text);
}
