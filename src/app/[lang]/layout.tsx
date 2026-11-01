import type { Metadata } from "next";
import { lang } from "next/root-params";
import { getDictionary } from "@/i18n/dictionaries";
import { locales } from "@/i18n/config";
import "../globals.css";

export async function generateStaticParams() {
  return locales.map((l) => ({ lang: l }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return {
    title: t.meta.title,
    description: t.meta.description,
    alternates: {
      languages: { lt: "/lt", en: "/en" },
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <html lang={await lang()}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
