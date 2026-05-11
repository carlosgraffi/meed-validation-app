"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ExpertRow } from "./AdminDashboard";

export function ReassignDialog({
  cities,
  experts,
}: {
  cities: { cityId: string; displayName: string }[];
  experts: ExpertRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cityId, setCityId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!from || !to || !cityId || from === to) {
      setErr("Pick a from-expert, to-expert (different), and a city.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/reassign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromExpertId: from, toExpertId: to, cityId }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(data.error ?? "Reassignment failed.");
      return;
    }
    setOpen(false);
    setFrom("");
    setTo("");
    setCityId("");
    router.refresh();
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Reassign a city
      </Button>
    );
  }

  return (
    <div className="border rounded-md p-3 bg-muted/30 space-y-3 min-w-[420px]">
      <div className="text-sm font-medium">Reassign a city between experts</div>
      <div className="grid sm:grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Select value={from} onValueChange={setFrom}>
            <SelectTrigger>
              <SelectValue placeholder="From expert" />
            </SelectTrigger>
            <SelectContent>
              {experts.map((e) => (
                <SelectItem key={e.expertId} value={e.expertId}>
                  {e.fullName} ({e.assigned}c)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Select value={to} onValueChange={setTo}>
            <SelectTrigger>
              <SelectValue placeholder="To expert" />
            </SelectTrigger>
            <SelectContent>
              {experts.map((e) => (
                <SelectItem key={e.expertId} value={e.expertId}>
                  {e.fullName} ({e.assigned}c)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">City</Label>
          <Select value={cityId} onValueChange={setCityId}>
            <SelectTrigger>
              <SelectValue placeholder="City" />
            </SelectTrigger>
            <SelectContent>
              {cities.map((c) => (
                <SelectItem key={c.cityId} value={c.cityId}>
                  {c.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <div className="flex items-center gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy ? "Reassigning…" : "Reassign"}
        </Button>
      </div>
    </div>
  );
}
