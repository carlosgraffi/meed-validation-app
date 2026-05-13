"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LangToggle } from "@/components/LangToggle";

export function DemoLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await signIn("demo-password", { password, redirect: false });
    setBusy(false);
    if (!res || res.error) {
      setError("Incorrect password.");
      return;
    }
    // Hit the post-login router so we end up at onboarding (first time) or dashboard.
    const r = await fetch("/api/me/post-login-route", { cache: "no-store" });
    const data = (await r.json()) as { route: string };
    router.replace(data.route ?? "/dashboard");
    router.refresh();
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="absolute top-4 right-4">
        <LangToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Demo expert sign in</CardTitle>
          <CardDescription>
            Sandbox account for testing the expert flow. Evaluations submitted
            here are excluded from the CORFO metrics and the data export.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
                required
                disabled={busy}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <Button type="submit" disabled={busy || password.length === 0} className="w-full">
              {busy ? "Signing in…" : "Sign in as demo expert"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
