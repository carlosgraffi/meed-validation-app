import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DemoLoginForm } from "./DemoLoginForm";

export const dynamic = "force-dynamic";

export default async function DemoLoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.isAdmin) redirect("/admin");
  if (session?.user) redirect("/dashboard");
  return <DemoLoginForm />;
}
