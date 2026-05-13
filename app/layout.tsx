import "./globals.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LANG_COOKIE, normalizeLang, translate } from "@/lib/i18n";
import { Providers } from "./providers";
import { LangProvider } from "./LangProvider";

export async function generateMetadata(): Promise<Metadata> {
  const lang = normalizeLang(cookies().get(LANG_COOKIE)?.value);
  return {
    title: translate(lang, "common.metaTitle"),
    description: translate(lang, "common.metaDescription"),
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = normalizeLang(cookies().get(LANG_COOKIE)?.value);
  return (
    <html lang={lang}>
      <body className="min-h-screen bg-background text-foreground">
        <LangProvider initialLang={lang}>
          <Providers>{children}</Providers>
        </LangProvider>
      </body>
    </html>
  );
}
