"use client";

import { useT } from "@/components/LanguageProvider";

export function PrintButton() {
  const t = useT();
  return (
    <button className="btn btn-small btn-primary" type="button" onClick={() => window.print()}>
      {t("off.printSavePdf")}
    </button>
  );
}
