import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/utils";
import { SignOutLink } from "../dashboard/SignOutLink";

export const dynamic = "force-dynamic";

export default async function CompletePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");
  if (session.user.isAdmin) redirect("/admin");

  const expert = await prisma.expert.findUnique({ where: { id: session.user.id } });
  if (!expert) redirect("/");

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-2xl">{t("complete.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>{t("complete.body1")}</p>
          <p className="text-sm text-muted-foreground">{t("complete.body2")}</p>
          <div className="flex items-center justify-between pt-2">
            <Button asChild variant="outline">
              <Link href="/dashboard">{t("complete.backHome")}</Link>
            </Button>
            <SignOutLink />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
