"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LANG_COOKIE, LOCALES, type Locale } from "@/lib/i18n";
import { useLocale } from "@/components/LanguageProvider";

const SHORT: Record<Locale, string> = { en: "EN", sq: "SQ" };

/** Compact EN / SQ switch. Persists the choice in a cookie and refreshes so
 *  server components re-render in the chosen language. */
export function LanguageToggle() {
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (locale: Locale) => {
    if (locale === current) return;
    document.cookie = `${LANG_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  };

  return (
    <div
      className="inline-flex overflow-hidden rounded-md border border-line bg-white text-xs font-semibold"
      role="group"
      aria-label="Language"
      aria-busy={pending}
    >
      {LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => choose(locale)}
            aria-pressed={active}
            className={`px-2.5 py-2 transition ${
              active
                ? "bg-lab-burgundy text-white"
                : "text-ink hover:bg-lab-burgundy/10 hover:text-lab-burgundy"
            }`}
          >
            {SHORT[locale]}
          </button>
        );
      })}
    </div>
  );
}
