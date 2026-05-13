"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { translate, normalizeLang, type Lang } from "@/lib/i18n";

type Ctx = {
  lang: Lang;
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLang: (next: Lang) => Promise<void>;
};

const LangContext = createContext<Ctx | null>(null);

export function LangProvider({
  initialLang,
  children,
}: {
  initialLang: Lang;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>(initialLang);

  // Keep state in sync if the cookie-derived prop changes after a router.refresh().
  useEffect(() => {
    setLangState(initialLang);
  }, [initialLang]);

  const setLang = useCallback(
    async (next: Lang) => {
      const n = normalizeLang(next);
      setLangState(n); // optimistic — client components reading from context update immediately
      await fetch("/api/me/lang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang: n }),
      });
      // Re-fetch server components so server-rendered text updates too.
      router.refresh();
    },
    [router]
  );

  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(lang, key, vars);

  return (
    <LangContext.Provider value={{ lang, t, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useT must be used within <LangProvider>");
  return ctx.t;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within <LangProvider>");
  return [ctx.lang, ctx.setLang] as const;
}
