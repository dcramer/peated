import { getTrpcClient } from "@peated/web/lib/trpc/client.server";
export { default } from "@peated/web/components/defaultLayout";

export const fetchCache = "default-no-store";

export async function generateMetadata(props: {
  params: Promise<{ entityId: string }>;
}) {
  const params = await props.params;

  const { entityId } = params;

  const trpcClient = await getTrpcClient();
  const entity = await trpcClient.entityById.fetch(Number(entityId));

  return {
    title: `Whiskies from ${entity.name}`,
  };
}
