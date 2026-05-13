"use client";

import { signOut } from "next-auth/react";
import { useT } from "@/app/LangProvider";

export function SignOutLink() {
  const t = useT();
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
    >
      {t("common.logout")}
    </button>
  );
}
