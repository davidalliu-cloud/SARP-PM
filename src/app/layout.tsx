import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SARP PM",
  description: "Project management and cost-control for waterproofing projects.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
