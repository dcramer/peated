import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import { PageSection } from "@peated/web/components/pages/pageLayout.stylex";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import { cache } from "react";

import { TastingComments } from "./tastingComments.stylex";
import { TastingDetail } from "./tastingDetail.stylex";

const getTasting = cache(async (tastingId: number) => {
  const { client } = await getPublicPageServerClient();
  return await resolveOrNotFound(
    client.tastings.details({ tasting: tastingId }),
  );
});

export async function generateMetadata(props: {
  params: Promise<{ tastingId: string }>;
}) {
  const { tastingId } = await props.params;
  const tasting = await getTasting(Number(tastingId));
  const title = `${formatBottleDisplayName(tasting.bottle)} — tasting by ${tasting.createdBy.username}`;

  return {
    title,
    description: tasting.notes,
    openGraph: {
      title,
      description: tasting.notes,
      images: tasting.imageUrl ? [tasting.imageUrl] : undefined,
    },
    twitter: {
      card: tasting.imageUrl ? "summary_large_image" : "summary",
      images: tasting.imageUrl ? [tasting.imageUrl] : undefined,
    },
  };
}

export default async function TastingPage(props: {
  params: Promise<{ tastingId: string }>;
}) {
  const { tastingId } = await props.params;
  const tasting = await getTasting(Number(tastingId));
  return (
    <div>
      <TastingDetail tasting={tasting} />
      <div id="comments">
        <PageSection heading="Conversation">
          <TastingComments tastingId={tasting.id} />
        </PageSection>
      </div>
    </div>
  );
}
