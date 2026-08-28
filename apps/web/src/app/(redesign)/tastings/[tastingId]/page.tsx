import {
  TastingEntry,
  type TastingEntryMember,
} from "@peated/web/components/designSystem/components";
import {
  Avatar,
  PageHeader,
  PageSection,
} from "@peated/web/components/designSystem/patterns/pagePatternShell.stylex";
import TimeSince from "@peated/web/components/timeSince";
import { getBottlePlainTextIdentity } from "@peated/web/lib/bottleLabel";
import { getBottleMetadata } from "@peated/web/lib/bottleMetadata";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";

import { TastingComments } from "./tastingComments.stylex";

export async function generateMetadata(props: {
  params: Promise<{ tastingId: string }>;
}) {
  const { tastingId } = await props.params;
  const { client } = await getPublicPageServerClient();
  const tasting = await resolveOrNotFound(
    client.tastings.details({ tasting: Number(tastingId) }),
  );
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
  const tasting = await resolveOrNotFound(
    client.tastings.details({ tasting: Number(tastingId) }),
  );
  const commentList = await client.comments.list({ tasting: tasting.id });
  const member: TastingEntryMember = {
    description: tasting.notes,
    href: `/bottles/${tasting.bottle.id}`,
    metadata: getBottleMetadata(tasting.bottle),
    name: tasting.bottle.fullName,
    notes: tasting.tags,
    ratingBand: tasting.ratingBand ?? undefined,
  };

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
        <TastingEntry
          author={tasting.createdBy.username}
          authorHref={`/users/${tasting.createdBy.username}`}
          date={<TimeSince date={tasting.createdAt} />}
          leading={
            <Avatar
              imageUrl={tasting.createdBy.pictureUrl}
              initials={tasting.createdBy.username
                .slice(0, 2)
                .toLocaleUpperCase()}
            />
          }
          members={[member]}
        />
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
