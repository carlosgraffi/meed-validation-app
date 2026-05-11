"use client";

import { signOut } from "next-auth/react";
import { t } from "@/lib/utils";

export function SignOutLink() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
    >
      {t("common.logout")}
    </button>
  );
}
