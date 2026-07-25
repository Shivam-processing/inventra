import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LanguageProvider } from "@/components/language-provider";
import { getLocale } from "@/lib/i18n/get-locale";
import { localeConfig } from "@/lib/i18n/locales";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Inventra — From invention to patent-ready draft",
    template: "%s | Inventra",
  },
  description: "Structure your invention, review key features, explore related patents, and create an editable patent draft.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const config = localeConfig(locale);
  return (
    <html
      lang={config.htmlLang}
      dir={config.dir}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body><LanguageProvider locale={locale}>{children}</LanguageProvider></body>
    </html>
  );
}
