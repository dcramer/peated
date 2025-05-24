import { getServerClient } from "@peated/web/lib/orpc/client.server";

export { default } from "@peated/web/components/defaultLayout";

export async function generateMetadata({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const client = await getServerClient();

  const bottle = await client.bottles.details({ bottle: Number(bottleId) });

  return {
    title: `Releases of ${bottle.fullName}`,
    description: `Known releases of ${bottle.fullName}, including specific vintages and special releases.`,
  };
}
