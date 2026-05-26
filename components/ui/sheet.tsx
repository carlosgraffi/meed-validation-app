"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Right-anchored sheet (slide-out panel) used for showing extended context
 * without leaving the page — city full context, per-action context, etc.
 *
 * Renders nothing when `open` is false. Locks body scroll while open.
 * Click outside or press ESC to close.
 *
 * NOTE: rendered through a portal into `document.body` so the sheet escapes
 * the stacking context of whatever parent opens it. Several callers live
 * inside `position: sticky` wrappers, which form their own stacking context;
 * without the portal the sheet's z-index would be scoped to that context
 * and the fixed-position evaluation footer (z-40) would render on top.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  side = "right",
  width = "w-[min(28rem,100vw)]",
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title?: string;
  children: React.ReactNode;
  side?: "right" | "bottom";
  /** Tailwind width class. Defaults to ~448px on desktop, full-width on mobile. */
  width?: string;
}) {
  // Portal target only exists in the browser; guard SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => onOpenChange(false)}
            aria-hidden
          />
          <motion.aside
            className={cn(
              "fixed z-[60] bg-background shadow-2xl flex flex-col",
              side === "right" && `top-0 right-0 h-full ${width}`,
              side === "bottom" && "left-0 right-0 bottom-0 max-h-[85vh] rounded-t-xl"
            )}
            initial={side === "right" ? { x: "100%" } : { y: "100%" }}
            animate={side === "right" ? { x: 0 } : { y: 0 }}
            exit={side === "right" ? { x: "100%" } : { y: "100%" }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <header className="flex items-center justify-between gap-3 px-5 py-3 border-b shrink-0">
              {title ? (
                <h2 className="text-base font-semibold truncate">{title}</h2>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
