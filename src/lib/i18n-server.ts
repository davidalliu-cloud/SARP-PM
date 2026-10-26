import { cookies } from "next/headers";
import { createTranslator, DEFAULT_LOCALE, isLocale, LANG_COOKIE, type Locale, type TFunction } from "./i18n";
import { englishMessages, messages } from "./messages";

/** Active locale for this request, from the `lang` cookie (defaults to English). */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LANG_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Server-side translator bound to the active locale. */
export async function getT(): Promise<TFunction> {
  const locale = await getLocale();
  return createTranslator(messages[locale], englishMessages);
}
