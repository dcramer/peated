import { isORPCClientError } from "@peated/orpc/client/errors";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
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
  const [params, { client }] = await Promise.all([
    context.params,
    getAnonymousServerClient(),
  ]);
  const bottleId = parseRouteId(params.bottleId);
  const releaseId = parseRouteId(params.bottlingId);
  let target;
  try {
    target = await resolveOrNotFound(
      client.bottleReleases.target({
        bottle: bottleId,
        release: releaseId,
      }),
    );
  } catch (error) {
    if (isORPCClientError(error) && error.status === 409) {
      return new Response(null, { status: 409 });
    }

    throw error;
  }

  return new Response(null, {
    status: 308,
    headers: {
      Location: `/bottles/${target.bottleId}${request.nextUrl.search}`,
    },
  });
}
