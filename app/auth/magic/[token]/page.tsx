"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { t } from "@/lib/utils";

export default function MagicConsume() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Ref guard: React 18 StrictMode runs effects twice in dev. Without this,
  // the first call consumes the (single-use) token, the second sees it as
  // already-used, and the user is shown an error despite being signed in.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const res = await signIn("magic", {
        token: params.token,
        redirect: false,
      });
      if (!res || res.error) {
        setError(t("auth.linkInvalid"));
        return;
      }
      // Decide destination by hitting a small endpoint that tells us
      // where to go (onboarding vs dashboard vs admin).
      const r = await fetch("/api/me/post-login-route", { cache: "no-store" });
      const data = (await r.json()) as { route: string };
      router.replace(data.route ?? "/dashboard");
    })();
  }, [params.token, router]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        {error ? (
          <>
            <h1 className="text-2xl font-semibold">{t("common.error")}</h1>
            <p className="text-muted-foreground">{error}</p>
            <a href="/" className="underline text-sm">
              {t("common.back")}
            </a>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">{t("common.loading")}</h1>
            <p className="text-muted-foreground text-sm">
              Validando enlace de acceso…
            </p>
          </>
        )}
      </div>
    </main>
  );
}
