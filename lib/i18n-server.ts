import "server-only";
import { cookies } from "next/headers";
import { translate, normalizeLang, LANG_COOKIE, type Lang } from "./i18n";

export function getServerLang(): Lang {
  return normalizeLang(cookies().get(LANG_COOKIE)?.value);
}

/**
 * Returns a synchronous `t(key, vars)` bound to the current request's language
 * cookie. Use in server components:
 *
 *   const t = getServerT();
 *   return <h1>{t("dashboard.greeting", { name })}</h1>;
 */
export function getServerT() {
  const lang = getServerLang();
  return (key: string, vars?: Record<string, string | number>) =>
    translate(lang, key, vars);
}
