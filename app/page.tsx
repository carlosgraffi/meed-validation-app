"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/utils";

export default function Landing() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "unrecognized" | "invalid">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed.includes("@") || trimmed.length < 5) {
      setStatus("invalid");
      return;
    }
    setStatus("loading");
    const res = await fetch("/api/magic-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmed }),
    });
    if (res.status === 404) {
      setStatus("unrecognized");
      return;
    }
    if (!res.ok) {
      setStatus("invalid");
      return;
    }
    setStatus("sent");
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-2xl">{t("landing.title")}</CardTitle>
          <CardDescription className="space-y-3 pt-2 text-sm leading-relaxed">
            <p>{t("landing.intro1")}</p>
            <p>{t("landing.intro2")}</p>
            <p>{t("landing.intro3")}</p>
            <p className="text-muted-foreground">{t("landing.intro4")}</p>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "sent" ? (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">{t("landing.checkInboxTitle")}</h2>
              <p className="text-sm">{t("landing.checkInboxBody")}</p>
              <p className="text-sm text-muted-foreground">{t("landing.checkInboxNote")}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("landing.emailLabel")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("landing.emailPlaceholder")}
                  required
                  autoFocus
                  disabled={status === "loading"}
                />
                {status === "invalid" && (
                  <p className="text-xs text-destructive">{t("landing.invalidEmail")}</p>
                )}
                {status === "unrecognized" && (
                  <p className="text-xs text-destructive">{t("landing.unrecognized")}</p>
                )}
              </div>
              <Button type="submit" disabled={status === "loading"} className="w-full">
                {status === "loading" ? t("common.loading") : t("landing.submitButton")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
