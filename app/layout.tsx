import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";
import { t } from "@/lib/utils";

export const metadata: Metadata = {
  title: t("common.metaTitle"),
  description: t("common.metaDescription"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
