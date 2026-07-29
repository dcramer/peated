import { resolveLegacyBottleReleaseRedirect } from "@peated/web/lib/legacyBottleReleaseRedirect.server";
import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";

function parseRouteId(value: string) {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id < 1) {
    notFound();
  }

  return id;
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ bottleId: string; bottlingId: string }>;
  },
) {
  const params = await context.params;
  const bottleId = parseRouteId(params.bottleId);
  const releaseId = parseRouteId(params.bottlingId);
  const promotedBottle = await resolveLegacyBottleReleaseRedirect(
    bottleId,
    releaseId,
  );
  if ("conflict" in promotedBottle) {
    return new Response(null, { status: 409 });
  }

  return new Response(null, {
    status: 308,
    headers: {
      Location: `/bottles/${promotedBottle.bottleId}/edit${request.nextUrl.search}`,
    },
  });
}
