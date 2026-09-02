import { ButtonLink, EmptyState } from "@peated/web/components";
import { CommunityFeed } from "@peated/web/components/communityFeed.stylex";
import {
  PageColumns,
  PageHeader,
  PageSection,
} from "@peated/web/components/pages/pageLayout.stylex";
import { getCommunityFeedItems } from "@peated/web/lib/communityFeed";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Activity",
  description: "Recent whisky tastings and critic reviews on Peated.",
};

export default async function CommunityPage() {
  const { client } = await getAnonymousServerClient();
  const [memberTastings, criticReviews] = await Promise.all([
    client.tastings.list({ limit: 20 }),
    client.externalReviews.list({ limit: 20, sort: "recent" }),
  ]);
  const items = getCommunityFeedItems({
    criticReviews: criticReviews.results,
    memberTastings: memberTastings.results,
  });

  return (
    <div>
      <PageHeader
        actions={
          <ButtonLink
            href="/addBottle?intent=tasting"
            size="sm"
            variant="accent"
          >
            Log a tasting
          </ButtonLink>
        }
        description="Member tasting notes and published critic reviews, together by date."
        title="Activity"
      />
      <PageColumns>
        <PageSection heading="Latest">
          {items.length ? (
            <CommunityFeed
              ariaLabel="Latest community tastings and reviews"
              items={items}
              limit={20}
            />
          ) : (
            <EmptyState
              action={
                <ButtonLink
                  href="/addBottle?intent=tasting"
                  size="sm"
                  variant="accent"
                >
                  Log a tasting
                </ButtonLink>
              }
              heading="Nothing here yet"
            >
              New tastings and reviews will appear here.
            </EmptyState>
          )}
        </PageSection>
      </PageColumns>
    </div>
  );
}
