import { getTrpcClient } from "@peated/web/lib/trpc/client.server";

export { default } from "@peated/web/components/defaultLayout";

export async function generateMetadata({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const trpcClient = await getTrpcClient();
  const bottle = await trpcClient.bottleById.fetch(Number(bottleId));

  return {
    title: `Releases of ${bottle.fullName}`,
    description: `Known releases of ${bottle.fullName}, including specific vintages and special releases.`,
  };
}
