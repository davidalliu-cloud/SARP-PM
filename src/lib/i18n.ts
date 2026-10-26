// Core i18n primitives shared by server and client. No next/headers here so
// this module is safe to import from client components too.

export const LOCALES = ["en", "sq"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "sq";
export const LANG_COOKIE = "lang";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  sq: "Shqip",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export type Messages = Record<string, unknown>;

/** Resolve a dotted key against a messages tree, with {var} interpolation. */
export function translate(messages: Messages, key: string, vars?: Record<string, string | number>): string {
  const value = key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, messages);

  let text = typeof value === "string" ? value : key;
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${name}\\}`, "g"), String(replacement));
    }
  }
  return text;
}

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

/** Build a translator for `primary`, falling back to `fallback` (English) for any missing key. */
export function createTranslator(primary: Messages, fallback: Messages): TFunction {
  return (key, vars) => {
    const hit = translate(primary, key, vars);
    if (hit !== key) return hit;
    return translate(fallback, key, vars);
  };
}
