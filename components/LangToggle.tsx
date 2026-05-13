"use client";

import { Globe } from "lucide-react";
import { useLang } from "@/app/LangProvider";
import { cn } from "@/lib/utils";

/**
 * Compact language toggle: ES / EN segmented control. Sets the meed_lang
 * cookie via /api/me/lang and triggers a server-component refresh so
 * server-rendered text updates without a full page reload.
 */
export function LangToggle({ className }: { className?: string }) {
  const [lang, setLang] = useLang();
  return (
    <div
      role="group"
      aria-label="Language"
      className={cn(
        "inline-flex items-center gap-1 rounded-md border bg-background p-0.5 text-xs",
        className
      )}
    >
      <Globe className="h-3.5 w-3.5 ml-1.5 text-muted-foreground" aria-hidden />
      <button
        type="button"
        onClick={() => setLang("es")}
        aria-pressed={lang === "es"}
        className={cn(
          "rounded px-2 py-0.5 transition-colors",
          lang === "es"
            ? "bg-foreground text-background font-medium"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        ES
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        className={cn(
          "rounded px-2 py-0.5 transition-colors",
          lang === "en"
            ? "bg-foreground text-background font-medium"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        EN
      </button>
    </div>
  );
}
