import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import { computeLiveMetrics } from "@/lib/admin-metrics";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const metrics = await computeLiveMetrics();
  return NextResponse.json(metrics);
}
