import BottleOverview from "@peated/web/components/bottleOverview";
import BottleStats from "@peated/web/components/bottleStats";
import { summarize } from "@peated/web/lib/markdown";
import { getTrpcClient } from "@peated/web/lib/trpc/client.server";

export async function generateMetadata({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const trpcClient = await getTrpcClient();
  const bottle = await trpcClient.bottleById.fetch(Number(bottleId));

  const description = summarize(bottle.description || "", 200);

  return {
    title: bottle.fullName,
    description,
    image: bottle.imageUrl,
    openGraph: {
      title: bottle.fullName,
      description: description,
      image: bottle.imageUrl,
    },
    twitter: {
      card: "summary",
      image: bottle.imageUrl,
    },
  };
}

export default async function BottleDetails({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const trpcClient = await getTrpcClient();
  const bottle = await trpcClient.bottleById.fetch(Number(bottleId));

  return (
    <>
      <BottleStats bottle={bottle} />
      <BottleOverview bottle={bottle} />
    </>
  );
}
