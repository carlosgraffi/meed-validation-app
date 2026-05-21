"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PillarDisclosure } from "@/components/PillarDisclosure";
import { LangToggle } from "@/components/LangToggle";
import { cn } from "@/lib/utils";
import { useT, useCityText } from "@/app/LangProvider";

const SECTORS = ["energia", "transporte", "residuos", "ippu", "afolu", "transversal", "otro"] as const;

type Expert = {
  id: string;
  email: string;
  fullName: string;
  sectorSpecialization: string | null;
};
type CityRow = {
  cityId: string;
  displayName: string;
  displayNameEn: string;
  region: string;
  regionEn: string;
  dominantSector: string;
};

export function OnboardingForm({ expert, cities }: { expert: Expert; cities: CityRow[] }) {
  const t = useT();
  const ct = useCityText();
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState(expert.fullName);
  const [sector, setSector] = useState<string>(expert.sectorSpecialization ?? "");
  const [preferred, setPreferred] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePref = (id: string) => {
    setPreferred((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 2) return cur; // max 2
      return [...cur, id];
    });
  };

  const submit = async () => {
    setError(null);
    if (!consent) {
      setError(t("onboarding.errorMustConsent"));
      return;
    }
    if (preferred.length > 2) {
      setError(t("onboarding.errorMaxTwoCities"));
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/me/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: name.trim(),
        sectorSpecialization: sector || null,
        preferredCityIds: preferred,
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

      <Card>
        <CardHeader>
          <CardTitle>{t("onboarding.section3Title")}</CardTitle>
          <CardDescription>{t("onboarding.preferenceIntro")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t("onboarding.preferenceHelp")}</p>
          <ul className="grid sm:grid-cols-2 gap-2">
            {cities.map((c) => {
              const selected = preferred.includes(c.cityId);
              const disabled = !selected && preferred.length >= 2;
              return (
                <li key={c.cityId}>
                  <button
                    type="button"
                    onClick={() => togglePref(c.cityId)}
                    disabled={disabled}
                    className={cn(
                      "w-full text-left rounded-md border p-3 transition-colors",
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-input hover:border-primary/50",
                      disabled && !selected && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="font-medium text-sm">{ct.displayName(c)}</div>
                    <div className="text-xs text-muted-foreground mt-1">{ct.region(c)}</div>
                    <Badge variant="muted" className="mt-2">
                      {t(`sectors.${c.dominantSector}` as never)}
                    </Badge>
                  </button>
                </li>
              );
            })}
          </ul>
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
