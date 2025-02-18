import { getTrpcClient } from "@peated/web/lib/trpc/client.server";
export { default } from "@peated/web/components/defaultLayout";

export const fetchCache = "default-no-store";

export async function generateMetadata({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const trpcClient = await getTrpcClient();
  const entity = await trpcClient.entityById.fetch(Number(entityId));

  return {
    title: `Whiskies from ${entity.name}`,
  };
}
