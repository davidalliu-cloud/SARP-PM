"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createTranslator, type Locale, type Messages, type TFunction } from "@/lib/i18n";
import { englishMessages } from "@/lib/messages";

type LanguageContextValue = { locale: Locale; t: TFunction };

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  const value = useMemo<LanguageContextValue>(
    () => ({ locale, t: createTranslator(messages, englishMessages) }),
    [locale, messages],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Safe fallback so a stray client component outside the provider still renders English.
    return { locale: "en", t: createTranslator(englishMessages, englishMessages) };
  }
  return ctx;
}

export function useT(): TFunction {
  return useLanguage().t;
}

export function useLocale(): Locale {
  return useLanguage().locale;
}
