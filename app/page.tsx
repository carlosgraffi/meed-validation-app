"use client";

import { Mail, KeyRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LangToggle } from "@/components/LangToggle";
import { useT } from "@/app/LangProvider";

/**
 * Public landing page. SSG distributes magic-link URLs to experts via email
 * themselves — we never see or send those emails. So this page is purely
 * informational: tell anyone who lands here without a link what to do (open
 * the email they got, or contact SSG to be re-sent). No form, no API call.
 */
export default function Landing() {
  const t = useT();
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="absolute top-4 right-4">
        <LangToggle />
      </div>
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-2xl">{t("landing.title")}</CardTitle>
          <CardDescription className="pt-2 text-sm leading-relaxed">
            {t("landing.intro")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <section className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <KeyRound className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden />
              <div>
                <h2 className="text-base font-semibold">{t("landing.useLinkTitle")}</h2>
                <p className="text-sm leading-relaxed mt-1">{t("landing.useLinkBody")}</p>
                <p className="text-xs text-muted-foreground mt-2">{t("landing.useLinkExpiry")}</p>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
              <div>
                <h3 className="text-sm font-medium">{t("landing.lostLinkTitle")}</h3>
                <p className="text-xs text-muted-foreground mt-1">{t("landing.lostLinkBody")}</p>
              </div>
            </div>
          </section>
        </CardContent>
      </Card>
    </main>
  );
}
