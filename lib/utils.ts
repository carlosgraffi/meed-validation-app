import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
