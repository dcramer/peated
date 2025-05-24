import { getServerClient } from "@peated/web/lib/orpc/client.server";
export { default } from "@peated/web/components/defaultLayout";

export const fetchCache = "default-no-store";

export async function generateMetadata({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const client = await getServerClient();

  const entity = await client.entities.details({ entity: Number(entityId) });

  return {
    title: `Whiskies from ${entity.name}`,
  };
}
