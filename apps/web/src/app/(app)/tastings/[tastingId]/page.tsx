import {
  PageColumns,
  PageSection,
} from "@peated/web/components/pages/pageLayout.stylex";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { getTastingPage } from "@peated/web/lib/tastingPage.server";
import {
  getTastingSeoMetadata,
  serializeTastingStructuredData,
} from "@peated/web/lib/tastingSeo";

import { TastingComments } from "./tastingComments.stylex";
import { TastingDetail, TastingRail } from "./tastingDetail.stylex";

export async function generateMetadata(props: {
  params: Promise<{ tastingId: string }>;
}) {
  const { tastingId } = await props.params;
  const tasting = await getTastingPage(tastingId);
  return getTastingSeoMetadata(tasting);
}

export default async function TastingPage(props: {
  params: Promise<{ tastingId: string }>;
}) {
  const { tastingId } = await props.params;
  const tasting = await getTastingPage(tastingId);
  const structuredData = serializeTastingStructuredData(tasting);
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
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: structuredData }}
        />
      )}
      <TastingDetail tasting={tasting} />
      <div id="comments">
        <PageSection heading="Comments">
          <TastingComments tastingId={tasting.id} />
        </PageSection>
      </div>
    </PageColumns>
  );
}
