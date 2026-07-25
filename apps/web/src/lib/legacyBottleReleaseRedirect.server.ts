import { isORPCClientError } from "@peated/orpc/client/errors";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";

export async function resolveLegacyBottleReleaseRedirect(
  bottleId: number,
  releaseId: number,
): Promise<{ bottleId: number } | { conflict: true }> {
  const { client } = await getAnonymousServerClient();

  try {
    const target = await resolveOrNotFound(
      client.bottleReleases.target({
        bottle: bottleId,
        release: releaseId,
      }),
    );
    return { bottleId: target.bottleId };
  } catch (error) {
    if (isORPCClientError(error) && error.status === 409) {
      return { conflict: true };
    }

    throw error;
  }
}
