import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import {
  PageColumns,
  PageSection,
} from "@peated/web/components/pages/pageLayout.stylex";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import { cache } from "react";

import { TastingComments } from "./tastingComments.stylex";
import { TastingDetail, TastingRail } from "./tastingDetail.stylex";

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
  const { client } = await getPublicPageServerClient();
  const [memberTastings, memberReviews, externalReviews] = await Promise.all([
    client.tastings.list({ user: tasting.createdBy.id, limit: 5 }),
    client.memberReviews.list({ bottle: tasting.bottle.id, limit: 4 }),
    client.externalReviews.list({ bottle: tasting.bottle.id, limit: 4 }),
  ]);

  return (
    <PageColumns
      rail={
        <TastingRail
          externalReviews={externalReviews.results}
          memberReviews={memberReviews.results}
          memberTastings={memberTastings.results}
          tasting={tasting}
        />
      }
      railBehavior="stack"
    >
      <TastingDetail tasting={tasting} />
      <div id="comments">
        <PageSection heading="Comments">
          <TastingComments tastingId={tasting.id} />
        </PageSection>
      </div>
    </PageColumns>
  );
}
