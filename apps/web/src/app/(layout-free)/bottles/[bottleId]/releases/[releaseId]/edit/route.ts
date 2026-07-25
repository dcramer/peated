import { resolveLegacyBottleReleaseRedirect } from "@peated/web/lib/legacyBottleReleaseRedirect.server";
import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";

function parseRouteId(value: string): number {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id < 1) {
    notFound();
  }

  return id;
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ bottleId: string; releaseId: string }>;
  },
) {
  const { bottleId: bottleParam, releaseId: releaseParam } =
    await context.params;
  const bottleId = parseRouteId(bottleParam);
  const releaseId = parseRouteId(releaseParam);
  const target = await resolveLegacyBottleReleaseRedirect(bottleId, releaseId);
  if ("conflict" in target) {
    return new Response(null, { status: 409 });
  }

  return new Response(null, {
    status: 308,
    headers: {
      Location: `/bottles/${target.bottleId}/edit${request.nextUrl.search}`,
    },
  });
}
