"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type RatingComment = {
  actionId: string;
  actionName: string;
  modelRank: number;
  question: string;
  likert: number;
  notSure: boolean;
  comment: string;
};
type CityComments = {
  cityId: string;
  cityName: string;
  submittedAt: string | null;
  ratingComments: RatingComment[];
  top3AgreementComment: string | null;
  top10AgreementComment: string | null;
  reorderComment: string | null;
  cityComment: string | null;
  missingActions: string[];
};
type ExpertComments = {
  expertId: string;
  fullName: string;
  cities: CityComments[];
};

export function CommentsPanel() {
  const [experts, setExperts] = useState<ExpertComments[] | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/comments", { cache: "no-store" });
    setLoading(false);
    if (!res.ok) return;
    const data = (await res.json()) as { experts: ExpertComments[] };
    setExperts(data.experts);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Expert comments</CardTitle>
            <CardDescription>
              Free-text feedback per expert: per-action rating comments plus
              evaluation-level notes (agreement, reorder, missing actions, city).
            </CardDescription>
          </div>
          <Button variant="outline" onClick={refresh} disabled={loading}>
            {loading ? "Loading…" : experts ? "Refresh comments" : "Load comments"}
          </Button>
        </div>
      </CardHeader>
      {experts && (
        <CardContent className="space-y-8">
          {experts.length === 0 && (
            <p className="text-sm text-muted-foreground">No comments submitted yet.</p>
          )}
          {experts.map((expert) => (
            <div key={expert.expertId} className="space-y-4">
              <h3 className="text-base font-semibold">{expert.fullName}</h3>
              {expert.cities.map((city) => (
                <div key={city.cityId} className="border rounded-md p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{city.cityName}</span>
                    <span className="text-xs text-muted-foreground">
                      {city.submittedAt
                        ? `submitted ${new Date(city.submittedAt).toLocaleString()}`
                        : "in progress"}
                    </span>
                  </div>

                  {city.ratingComments.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b">
                            <th className="py-2 pr-4">Action</th>
                            <th className="py-2 pr-4 whitespace-nowrap">Rating</th>
                            <th className="py-2 pr-4">Comment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {city.ratingComments.map((r, i) => (
                            <tr key={`${r.actionId}-${r.question}-${i}`} className="border-b last:border-b-0 align-top">
                              <td className="py-2 pr-4">
                                <div className="font-medium">{r.actionName}</div>
                                <div className="text-xs text-muted-foreground">
                                  {r.question === "top3" ? "Top-3" : "Top-10"} · model rank {r.modelRank}
                                </div>
                              </td>
                              <td className="py-2 pr-4 whitespace-nowrap">
                                <Badge variant={r.likert >= 4 ? "default" : "destructive"}>
                                  {r.likert} / 5
                                </Badge>
                                {r.notSure && (
                                  <Badge variant="muted" className="ml-1">
                                    not sure
                                  </Badge>
                                )}
                              </td>
                              <td className="py-2 pr-4 whitespace-pre-wrap">{r.comment}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <EvalNotes city={city} />
                </div>
              ))}
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

/** Evaluation-level free-text that isn't tied to a single action. */
function EvalNotes({ city }: { city: CityComments }) {
  const notes: { label: string; value: string }[] = [];
  if (city.top3AgreementComment) notes.push({ label: "Top-3 agreement", value: city.top3AgreementComment });
  if (city.top10AgreementComment) notes.push({ label: "Top-10 agreement", value: city.top10AgreementComment });
  if (city.reorderComment) notes.push({ label: "Reorder (top-5)", value: city.reorderComment });
  if (city.cityComment) notes.push({ label: "City comment", value: city.cityComment });
  city.missingActions.forEach((m, i) =>
    notes.push({ label: city.missingActions.length > 1 ? `Missing action ${i + 1}` : "Missing action", value: m })
  );

  if (notes.length === 0) return null;
  return (
    <dl className="space-y-2 text-sm">
      {notes.map((n, i) => (
        <div key={i} className="grid grid-cols-[10rem_1fr] gap-2">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground pt-0.5">{n.label}</dt>
          <dd className="whitespace-pre-wrap">{n.value}</dd>
        </div>
      ))}
    </dl>
  );
}
