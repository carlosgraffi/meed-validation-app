import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminLoginForm } from "./AdminLoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.isAdmin) redirect("/admin");
  // If a non-admin user lands here, just send them home.
  if (session?.user) redirect("/dashboard");

  return <AdminLoginForm />;
}
