import TastingComments from "@peated/web/components/tastingComments";
import TastingListItem from "@peated/web/components/tastingListItem";
import { getTasting } from "../utils.server";

export async function generateMetadata({
  params: { tastingId },
}: {
  params: { tastingId: string };
}) {
  const tasting = await getTasting(Number(tastingId));
  const title = `${tasting.bottle.fullName} - Tasting Notes by ${tasting.createdBy.username}`;
  return {
    title,
    openGraph: {
      title,
      ...(tasting.imageUrl
        ? {
            image: tasting.imageUrl,
          }
        : {}),
    },
    twitter: {
      ...(tasting.imageUrl
        ? {
            card: "summary_large_image",
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
  const tasting = await getTasting(Number(tastingId));

  return (
    <>
      <ul className="mb-4">
        <TastingListItem tasting={tasting} noCommentAction />
      </ul>

      <TastingComments tastingId={tasting.id} />
    </>
  );
}
