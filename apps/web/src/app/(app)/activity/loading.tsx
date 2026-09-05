"use client";

import { PageTabs } from "@peated/web/components";
import { ActivityPage } from "@peated/web/components/pages/activityPage.stylex";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { getActivityFeedSelection } from "./loadActivityFeed";

export default function ActivityLoading() {
  return (
    <Suspense fallback={<ActivityLoadingPage selectedFeed="everyone" />}>
      <ActivityLoadingSelection />
    </Suspense>
  );
}

function ActivityLoadingSelection() {
  const searchParams = useSearchParams();
  const selectedFeed = getActivityFeedSelection(
    searchParams.get("feed") ?? undefined,
  );

  return <ActivityLoadingPage selectedFeed={selectedFeed} />;
}

function ActivityLoadingPage({
  selectedFeed,
}: {
  selectedFeed: "everyone" | "following";
}) {
  return (
    <ActivityPage
      items={[]}
      loading
      selector={
        <PageTabs
          ariaLabel="Activity feeds"
          currentHref={`/activity?feed=${selectedFeed}`}
          items={[
            { href: "/activity?feed=following", label: "Following" },
            { href: "/activity?feed=everyone", label: "Everyone" },
          ]}
        />
      }
    />
  );
}
