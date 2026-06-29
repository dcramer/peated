import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";

export { default } from "@peated/web/components/defaultLayout";

export async function generateMetadata({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const { client } = await getAnonymousServerClient();

  const bottle = await resolveOrNotFound(
    client.bottles.details({ bottle: Number(bottleId) }),
  );

  return {
    title: `Bottlings of ${bottle.fullName}`,
    description: `Known bottlings of ${bottle.fullName}, including optional exact picks and single casks.`,
  };
}
