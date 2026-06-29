import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
export { default } from "@peated/web/components/defaultLayout";

export async function generateMetadata({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const { client } = await getAnonymousServerClient();

  const entity = await resolveOrNotFound(
    client.entities.details({ entity: Number(entityId) }),
  );

  return {
    title: `Whiskies from ${entity.name}`,
  };
}
