import TastingComments from "@peated/web/components/tastingComments";
import TastingList from "@peated/web/components/tastingList";
import { getTrpcClient } from "@peated/web/lib/trpc/client.server";

export async function generateMetadata({
  params: { tastingId },
}: {
  params: { tastingId: string };
}) {
  const trpcClient = await getTrpcClient();
  const tasting = await trpcClient.tastingById.fetch(Number(tastingId));
  const title = `${tasting.bottle.fullName} - Tasting Notes by ${tasting.createdBy.username}`;
  return {
    title,
    description: tasting.notes,
    openGraph: {
      title,
      description: tasting.notes,
      ...(tasting.imageUrl
        ? {
            images: [tasting.imageUrl],
          }
        : {}),
    },
    twitter: {
      ...(tasting.imageUrl
        ? {
            card: "summary_large_image",
            images: [tasting.imageUrl],
          }
        : {}),
    },
  };
}

export default async function Page({
  params: { tastingId },
}: {
  params: { tastingId: string };
}) {
  const trpcClient = await getTrpcClient();
  const tasting = await trpcClient.tastingById.fetch(Number(tastingId));

  return (
    <>
      <div className="mb-4">
        <TastingList values={[tasting]} noCommentAction />
      </div>
      <TastingComments tastingId={tasting.id} />
    </>
  );
}
