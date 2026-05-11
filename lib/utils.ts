import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import esLocale from "@/locales/es.json";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Locale = typeof esLocale;
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

export type LocaleKey = PathInto<Locale> & string;

function lookup(obj: unknown, parts: string[]): string | undefined {
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

export function t(key: LocaleKey, vars?: Record<string, string | number>): string {
  const value = lookup(esLocale, key.split("."));
  if (value === undefined) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[locale] missing key: ${key}`);
    }
    return key;
  }
  if (!vars) return value;
  return value.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{{${k}}}`
  );
}

export function formatNumber(n: number, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat("es-CL", opts).format(n);
}

export function formatEmissions(tCO2eq: number | null): string {
  if (tCO2eq == null) return "—";
  if (tCO2eq >= 1000) {
    return `${formatNumber(tCO2eq / 1000, { maximumFractionDigits: 1 })} kt`;
  }
  return `${formatNumber(tCO2eq, { maximumFractionDigits: 0 })} t`;
}
