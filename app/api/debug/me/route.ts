import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadCities, loadModelOutputs } from "@/lib/fixtures";

/**
 * Read-only diagnostic for 404-on-evaluate debugging.
 *
 * Returns the current session's view of itself + the DB row + the assignments
 * + which cityIds the loaded fixtures know about. Lets Carlos compare what
 * the server SEES against what he EXPECTS.
 *
 * Not gated to admin — gated to "any authenticated session" — because the
 * point is to debug your own session even if it isn't admin.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({
      authenticated: false,
      note: "No session cookie. Open this URL inside an authenticated browser tab.",
    });
  }

  const expert = await prisma.expert.findUnique({
    where: { id: session.user.id },
    include: { assignments: true },
  });

  const cities = loadCities().map((c) => c.cityId);
  const outputs = Object.keys(loadModelOutputs());

  return NextResponse.json({
    authenticated: true,
    session: {
      userId: session.user.id,
      email: session.user.email,
      isAdmin: session.user.isAdmin,
    },
    expertInDb: expert
      ? {
          id: expert.id,
          email: expert.email,
          fullName: expert.fullName,
          consentedAt: expert.consentedAt,
          assignmentCityIds: expert.assignments.map((a) => a.cityId),
        }
      : null,
    fixtures: {
      citiesJson: cities,
      modelOutputsJson: outputs,
    },
    diagnosis: diagnose({
      sessionId: session.user.id,
      expertExists: !!expert,
      assignmentCityIds: expert?.assignments.map((a) => a.cityId) ?? [],
      fixtureCityIds: cities,
      outputCityIds: outputs,
    }),
  });
}

function diagnose(s: {
  sessionId: string;
  expertExists: boolean;
  assignmentCityIds: string[];
  fixtureCityIds: string[];
  outputCityIds: string[];
}) {
  const notes: string[] = [];
  if (!s.expertExists) {
    notes.push(
      `Session expertId "${s.sessionId}" is NOT in the DB. Your session cookie is stale — sign out and back in.`
    );
  }
  if (s.expertExists && s.assignmentCityIds.length === 0) {
    notes.push(
      `Expert exists but has zero assignments. Run 'railway run npm run seed -- --stratify' or click Reset Demo Expert in /admin.`
    );
  }
  const fixtureMissing = s.assignmentCityIds.filter(
    (id) => !s.fixtureCityIds.includes(id)
  );
  if (fixtureMissing.length > 0) {
    notes.push(
      `Assignments reference cityIds not in cities.json: ${fixtureMissing.join(", ")}. Reseed.`
    );
  }
  const outputsMissing = s.assignmentCityIds.filter(
    (id) => !s.outputCityIds.includes(id)
  );
  if (outputsMissing.length > 0) {
    notes.push(
      `Assignments reference cityIds not in model_outputs.json: ${outputsMissing.join(", ")}. Stale deploy.`
    );
  }
  if (notes.length === 0) {
    notes.push("Everything checks out from the server side. The 404 must be elsewhere.");
  }
  return notes;
}
