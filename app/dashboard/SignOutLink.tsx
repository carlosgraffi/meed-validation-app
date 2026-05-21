"use client";

import { signOut } from "next-auth/react";
import { useT } from "@/app/LangProvider";

export function SignOutLink() {
  const t = useT();

  // Sign out then navigate to "/" manually. We avoid `signOut({ callbackUrl })`
  // because NextAuth resolves callbackUrl against `NEXTAUTH_URL`, and on Railway
  // that produced a shorter URL than expected for Carlos. Doing the redirect
  // via window.location keeps us on the SAME origin the user is currently on,
  // regardless of what NEXTAUTH_URL is set to.
  const handleSignOut = async () => {
    await signOut({ redirect: false });
    window.location.replace("/");
  };

  return (
    <button
      onClick={handleSignOut}
      className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
    >
      {t("common.logout")}
    </button>
  );
}
