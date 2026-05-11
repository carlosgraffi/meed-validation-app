"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/utils";

export function SectionC({
  missing,
  onChange,
  disabled,
}: {
  missing: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [local, setLocal] = useState<string[]>(missing);

  const setIdx = (i: number, value: string) => {
    const next = [...local];
    next[i] = value;
    setLocal(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("evaluate.sectionCtitle")}</CardTitle>
        <CardDescription>{t("evaluate.sectionCsubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {local.map((v, i) => (
          <div key={i} className="space-y-1">
            <Label htmlFor={`m-${i}`} className="text-xs text-muted-foreground">
              {t("evaluate.missingPlaceholder", { n: i + 1 })}
            </Label>
            <Input
              id={`m-${i}`}
              value={v}
              maxLength={200}
              disabled={disabled}
              onChange={(e) => setIdx(i, e.target.value)}
              onBlur={() => onChange(local)}
              placeholder={t("evaluate.missingPlaceholder", { n: i + 1 })}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
