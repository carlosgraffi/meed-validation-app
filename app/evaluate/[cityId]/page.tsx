import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadActions, loadCities, loadModelOutputs } from "@/lib/fixtures";
import { EvaluationForm } from "./EvaluationForm";

export const dynamic = "force-dynamic";

export default async function EvaluatePage({ params }: { params: { cityId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");
  if (session.user.isAdmin) redirect("/admin");

  const expertId = session.user.id;
  const cityId = params.cityId;

  // Authorization: this expert must be assigned to this city
  const assignment = await prisma.assignment.findUnique({
    where: { expertId_cityId: { expertId, cityId } },
  });
  if (!assignment) notFound();

  const cities = loadCities();
  const city = cities.find((c) => c.cityId === cityId);
  if (!city) notFound();

  const outputs = loadModelOutputs();
  const cityOutput = outputs[cityId];
  if (!cityOutput) notFound();
  const actions = loadActions();
  const actionMap = new Map(actions.map((a) => [a.actionId, a]));
  const rankedActions = cityOutput.topActions
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((t) => {
      const action = actionMap.get(t.actionId);
      if (!action) throw new Error(`actions.json missing actionId ${t.actionId}`);
      return { rank: t.rank, action };
    });

  // Find or create evaluation row (startedAt is set on first load)
  const evaluation = await prisma.evaluation.upsert({
    where: { expertId_cityId: { expertId, cityId } },
    create: { expertId, cityId },
    update: {},
    include: { ratings: true, reorderTop5: true },
  });

  const ratingsByActionId: Record<string, { likert: number; notSure: boolean }> = {};
  for (const r of evaluation.ratings) {
    ratingsByActionId[r.actionId] = { likert: r.likert, notSure: r.notSure };
  }

  const missingActions: string[] = evaluation.missingActions
    ? (JSON.parse(evaluation.missingActions) as string[])
    : [];

  const reorderTop5: string[] | null = evaluation.reorderTop5
    ? (JSON.parse(evaluation.reorderTop5.orderedActionIds) as string[])
    : null;

  return (
    <EvaluationForm
      city={city}
      rankedActions={rankedActions}
      initial={{
        evaluationId: evaluation.id,
        submitted: !!evaluation.submittedAt,
        ratings: ratingsByActionId,
        missingActions,
        reorderTop5,
        cityComment: evaluation.cityComment ?? "",
      }}
    />
  );
}
