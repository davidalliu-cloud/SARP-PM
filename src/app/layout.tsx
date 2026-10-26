import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/components/LanguageProvider";
import { getLocale } from "@/lib/i18n-server";
import { messages } from "@/lib/messages";

export const metadata: Metadata = {
  title: "SARP PM",
  description: "Project management and cost-control for waterproofing projects.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <LanguageProvider locale={locale} messages={messages[locale]}>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
