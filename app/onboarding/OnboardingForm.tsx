"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PillarDisclosure } from "@/components/PillarDisclosure";
import { LangToggle } from "@/components/LangToggle";
import { useT } from "@/app/LangProvider";

const SECTORS = ["energia", "transporte", "residuos", "ippu", "afolu", "transversal", "otro"] as const;

type Expert = {
  id: string;
  email: string;
  fullName: string;
  sectorSpecialization: string | null;
};

export function OnboardingForm({ expert }: { expert: Expert }) {
  const t = useT();
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState(expert.fullName);
  const [sector, setSector] = useState<string>(expert.sectorSpecialization ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!consent) {
      setError(t("onboarding.errorMustConsent"));
      return;
    }
    setSubmitting(true);
    // City preferences were dropped — every expert evaluates all 3 cities, so
    // there's nothing meaningful to pick. Sending an empty preferredCityIds[]
    // keeps the API signature stable.
    const res = await fetch("/api/me/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: name.trim(),
        sectorSpecialization: sector || null,
        preferredCityIds: [],
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(t("common.error"));
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  };

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t("onboarding.title")}</h1>
        <LangToggle />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("onboarding.section1Title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed">{t("onboarding.consentBody")}</p>
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
            <span className="text-sm">{t("onboarding.consentCheckbox")}</span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("onboarding.section2Title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("onboarding.nameLabel")}</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("onboarding.emailLabel")}</Label>
            <Input id="email" value={expert.email} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label>{t("onboarding.sectorLabel")}</Label>
            <Select value={sector} onValueChange={setSector}>
              <SelectTrigger>
                <SelectValue placeholder={t("onboarding.sectorPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {SECTORS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`onboarding.sectorOptions.${s}` as never)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("onboarding.pillarsSectionTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PillarDisclosure variant="full" />
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button onClick={submit} disabled={submitting || !consent} size="lg">
          {submitting ? t("common.saving") : t("onboarding.submitButton")}
        </Button>
      </div>
    </main>
  );
}
