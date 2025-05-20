import { client } from "@peated/web/lib/orpc/client";
export { default } from "@peated/web/components/defaultLayout";

export const fetchCache = "default-no-store";

export async function generateMetadata({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const entity = await client.entities.details({ entity: Number(entityId) });

  return {
    title: `Whiskies from ${entity.name}`,
  };
}
