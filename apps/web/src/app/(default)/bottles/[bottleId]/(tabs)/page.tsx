import BottleOverview from "@peated/web/components/bottleOverview";
import BottleStats from "@peated/web/components/bottleStats";
import { summarize } from "@peated/web/lib/markdown";
import { getServerClient } from "@peated/web/lib/orpc/client.server";

export async function generateMetadata({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const client = await getServerClient();

  const bottle = await client.bottles.details({
    bottle: Number(bottleId),
  });

  const description = summarize(bottle.description || "", 200);

  return {
    title: bottle.fullName,
    description,
    images: [bottle.imageUrl],
    openGraph: {
      title: bottle.fullName,
      description: description,
      images: [bottle.imageUrl],
    },
    twitter: {
      card: "summary",
      images: [bottle.imageUrl],
    },
  };
}

export default async function BottleDetails({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const client = await getServerClient();

  const bottle = await client.bottles.details({
    bottle: Number(bottleId),
  });

  return (
    <>
      <BottleStats bottle={bottle} />
      <BottleOverview bottle={bottle} />
    </>
  );
}
