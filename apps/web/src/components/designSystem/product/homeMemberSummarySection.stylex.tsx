"use client";

import { useQuery } from "@tanstack/react-query";

import { useORPC } from "../../../lib/orpc/context";
import { LoadingList, SectionError } from "../components";
import {
  HomeMemberSummary,
  HomeSectionLoading,
} from "../patterns/homeSummary.stylex";

export function HomeMemberSummarySection() {
  const orpc = useORPC();
  const details = useQuery(
    orpc.users.details.queryOptions({ input: { user: "me" } }),
  );
  const tastingStats = useQuery(
    orpc.users.tastingStats.queryOptions({ input: { user: "me" } }),
  );

  if (details.isPending || tastingStats.isPending) {
    return (
      <HomeSectionLoading>
        <LoadingList label="Loading your record" rows={3} />
      </HomeSectionLoading>
    );
  }

  if (details.error || tastingStats.error) {
    return (
      <SectionError
        heading="Your record is unavailable"
        onRetry={() => {
          void details.refetch();
          void tastingStats.refetch();
        }}
      >
        We could not load your tasting summary. Try again.
      </SectionError>
    );
  }

  return (
    <HomeMemberSummary
      facts={[
        { label: "On the shelf", value: details.data.stats.library.total },
        { label: "Bottles tasted", value: tastingStats.data.uniqueBottles },
        { label: "Contributions", value: details.data.stats.contributions },
      ]}
      ratings={tastingStats.data.ratings}
      totalTastings={details.data.stats.tastings}
    />
  );
}
