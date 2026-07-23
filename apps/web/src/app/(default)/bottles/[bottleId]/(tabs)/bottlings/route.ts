import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { getBottleGroupRouteRedirectPath } from "@peated/web/lib/tombstoneRedirect";
import { notFound, permanentRedirect } from "next/navigation";
import type { NextRequest } from "next/server";

function parseRouteId(value: string) {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id < 1) {
    notFound();
  }

  return id;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ bottleId: string }> },
) {
  const { bottleId } = await context.params;
  const bottle = await getBottlePage(parseRouteId(bottleId));

  if (!bottle.group) {
    throw new Error("Bottle details are missing their required group summary.");
  }

  permanentRedirect(await getBottleGroupRouteRedirectPath(bottle.group.id));
}
