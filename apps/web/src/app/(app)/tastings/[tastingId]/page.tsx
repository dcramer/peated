import {
  PageHeader,
  PageSection,
} from "@peated/web/components/designSystem/patterns/pageLayout.stylex";
import { TastingRecordEntry } from "@peated/web/components/tastingRecordEntry";
import { getBottlePlainTextIdentity } from "@peated/web/lib/bottleLabel";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import { cache } from "react";

import { TastingComments } from "./tastingComments.stylex";

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
  const title = `${getBottlePlainTextIdentity(tasting.bottle)} — tasting by ${tasting.createdBy.username}`;

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
  const { client } = await getPublicPageServerClient();
  const tasting = await getTasting(Number(tastingId));
  const commentList = await client.comments.list({ tasting: tasting.id });
  return (
    <div>
      <PageHeader
        eyebrow="Tasting record"
        parent={
          <a href={`/users/${tasting.createdBy.username}`}>
            {tasting.createdBy.username}
          </a>
        }
        title={getBottlePlainTextIdentity(tasting.bottle)}
      />
      <PageSection heading="Tasting">
        <TastingRecordEntry showFullNotes tasting={tasting} />
      </PageSection>
      <PageSection count={commentList.results.length} heading="Comments">
        <TastingComments
          initialCommentList={commentList}
          tastingId={tasting.id}
        />
      </PageSection>
    </div>
  );
}
