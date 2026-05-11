"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/utils";

const MAX = 1000;

export function SectionE({
  comment,
  onBlur,
  disabled,
}: {
  comment: string;
  onBlur: (next: string) => void;
  disabled?: boolean;
}) {
  const [local, setLocal] = useState(comment);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("evaluate.sectionEtitle")}</CardTitle>
        <CardDescription>{t("evaluate.sectionEsubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Textarea
          value={local}
          onChange={(e) => setLocal(e.target.value.slice(0, MAX))}
          onBlur={() => onBlur(local)}
          placeholder={t("evaluate.commentPlaceholder")}
          rows={5}
          disabled={disabled}
        />
        <div className="text-xs text-muted-foreground text-right">
          {t("evaluate.characterCount", { count: local.length, max: MAX })}
        </div>
      </CardContent>
    </Card>
  );
}
