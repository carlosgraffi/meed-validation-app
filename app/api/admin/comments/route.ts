import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import { prisma } from "@/lib/db";
import { loadActions, loadCities, loadExperts } from "@/lib/fixtures";

/**
 * Per-expert free-text feedback for the admin panel.
 *
 * Two kinds of comment live in the data and both are surfaced here:
 *   - Per-action rating comments (Rating.comment) — the expert's note on one
 *     action's Likert rating. Carries the action, modelRank, question
 *     (top3 / top10), Likert and not-sure flag so it reads as "user → action →
 *     rating → comment".
 *   - Evaluation-level free text (agreement comments, reorder note, city
 *     comment, missing-actions) — no single action, so grouped under the city.
 *
 * Only fixture experts are included (admin + demo excluded), and only
 * evaluations that actually carry at least one comment are returned, so the
 * panel stays readable.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const fixtureExperts = loadExperts();
  const fixtureExpertIds = fixtureExperts.map((e) => e.expertId);
  const expertNameById = new Map(fixtureExperts.map((e) => [e.expertId, e.fullName]));

  const actionNameById = new Map(loadActions().map((a) => [a.actionId, a.nameEs]));
  const cityNameById = new Map(loadCities().map((c) => [c.cityId, c.displayName]));

  const evaluations = await prisma.evaluation.findMany({
    where: { expertId: { in: fixtureExpertIds } },
    include: { ratings: { orderBy: [{ question: "asc" }, { modelRank: "asc" }] } },
    orderBy: [{ expertId: "asc" }, { cityId: "asc" }],
  });

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

  const byExpert = new Map<string, { expertId: string; fullName: string; cities: CityComments[] }>();

  for (const e of evaluations) {
    const ratingComments: RatingComment[] = e.ratings
      .filter((r) => r.comment && r.comment.trim() !== "")
      .map((r) => ({
        actionId: r.actionId,
        actionName: actionNameById.get(r.actionId) ?? r.actionId,
        modelRank: r.modelRank,
        question: r.question,
        likert: r.likert,
        notSure: r.notSure,
        comment: r.comment as string,
      }));

    const missingActions = e.missingActions
      ? (JSON.parse(e.missingActions) as string[]).filter((s) => s && s.trim() !== "")
      : [];

    const hasAny =
      ratingComments.length > 0 ||
      missingActions.length > 0 ||
      [e.top3AgreementComment, e.top10AgreementComment, e.reorderComment, e.cityComment].some(
        (c) => c && c.trim() !== ""
      );
    if (!hasAny) continue;

    const entry =
      byExpert.get(e.expertId) ??
      {
        expertId: e.expertId,
        fullName: expertNameById.get(e.expertId) ?? e.expertId,
        cities: [] as CityComments[],
      };
    entry.cities.push({
      cityId: e.cityId,
      cityName: cityNameById.get(e.cityId) ?? e.cityId,
      submittedAt: e.submittedAt?.toISOString() ?? null,
      ratingComments,
      top3AgreementComment: e.top3AgreementComment?.trim() || null,
      top10AgreementComment: e.top10AgreementComment?.trim() || null,
      reorderComment: e.reorderComment?.trim() || null,
      cityComment: e.cityComment?.trim() || null,
      missingActions,
    });
    byExpert.set(e.expertId, entry);
  }

  return NextResponse.json({ experts: Array.from(byExpert.values()) });
}
