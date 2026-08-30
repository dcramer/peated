"use client";

import { useQuery } from "@tanstack/react-query";

import {
  LoadingList,
  SectionError,
} from "@peated/web/components/designSystem/components";
import {
  HomeMemberSummary,
  HomeSectionLoading,
} from "@peated/web/components/designSystem/patterns/homeSummary.stylex";
import { useORPC } from "@peated/web/lib/orpc/context";
import { memberHomeQueries } from "@peated/web/lib/orpc/homeQueries";

export function HomeMemberSummarySection() {
  const orpc = useORPC();
  const details = useQuery(memberHomeQueries.member(orpc));
  const tastingStats = useQuery(memberHomeQueries.tastingStats(orpc));

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
        We couldn't load your record. Try again.
      </SectionError>
    );
  }

  return (
    <HomeMemberSummary
      facts={[
        { label: "In your library", value: details.data.stats.library.total },
        { label: "Bottles tasted", value: tastingStats.data.uniqueBottles },
        { label: "Contributions", value: details.data.stats.contributions },
      ]}
      bands={tastingStats.data.bands}
      totalTastings={details.data.stats.tastings}
    />
  );
}
