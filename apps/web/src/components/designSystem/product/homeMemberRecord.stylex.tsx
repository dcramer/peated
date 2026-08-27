"use client";

import { useQuery } from "@tanstack/react-query";

import { useORPC } from "../../../lib/orpc/context";
import { LoadingRecordList, ModuleError } from "../components";
import {
  HomeWidgetLoading,
  MemberRecordSummary,
} from "../patterns/homeWidgets.stylex";

export function HomeMemberRecord() {
  const orpc = useORPC();
  const details = useQuery(
    orpc.users.details.queryOptions({ input: { user: "me" } }),
  );
  const tastingStats = useQuery(
    orpc.users.tastingStats.queryOptions({ input: { user: "me" } }),
  );

  if (details.isPending || tastingStats.isPending) {
    return (
      <HomeWidgetLoading>
        <LoadingRecordList label="Loading your record" rows={3} />
      </HomeWidgetLoading>
    );
  }

  if (details.error || tastingStats.error) {
    return (
      <ModuleError
        heading="Your record is unavailable"
        onRetry={() => {
          void details.refetch();
          void tastingStats.refetch();
        }}
      >
        We could not load your tasting summary. Try again.
      </ModuleError>
    );
  }

  return (
    <MemberRecordSummary
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
