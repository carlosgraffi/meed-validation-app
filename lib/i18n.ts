/**
 * Locale-agnostic lookup. Works in both server and client contexts because
 * it accepts the locale as an argument rather than reading from any host
 * (cookies on server, React context on client).
 *
 * Client components → use `useT()` from app/LangProvider.tsx.
 * Server components → use `getServerT()` from lib/i18n-server.ts.
 *
 * Spanish remains the default and the source-of-truth keyspace; English is
 * a parallel translation that should mirror es.json key-for-key.
 */
import esLocale from "@/locales/es.json";
import enLocale from "@/locales/en.json";

export type Lang = "es" | "en";

export const LOCALES = {
  es: esLocale,
  en: enLocale,
} as const;

export const DEFAULT_LANG: Lang = "es";
export const LANG_COOKIE = "meed_lang";

type DefaultLocale = typeof esLocale;

type PathInto<T> = T extends string
  ? ""
  : {
      [K in keyof T]: K extends string
        ? PathInto<T[K]> extends infer P
          ? P extends ""
            ? K
            : `${K}.${P & string}`
          : never
        : never;
    }[keyof T];

export type LocaleKey = PathInto<DefaultLocale> & string;

function lookupRaw(obj: unknown, parts: string[]): string | undefined {
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

export function translate(
  lang: Lang,
  key: string,
  vars?: Record<string, string | number>
): string {
  const parts = key.split(".");
  let value = lookupRaw(LOCALES[lang], parts);
  // Fallback chain: requested lang → Spanish (source of truth) → key itself
  if (value === undefined && lang !== "es") {
    value = lookupRaw(LOCALES.es, parts);
  }
  if (value === undefined) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[i18n] missing key for lang=${lang}: ${key}`);
    }
    return key;
  }
  if (!vars) return value;
  return value.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{{${k}}}`
  );
}

export function normalizeLang(input: unknown): Lang {
  return input === "en" ? "en" : "es";
}
