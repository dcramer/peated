"use client";

import { useState } from "react";

import { HomeActivity } from "@peated/web/app/(app)/_components/home/homeActivity.stylex";
import { HomeCriticReviews } from "@peated/web/app/(app)/_components/home/homeCriticReviews.stylex";
import { HomeFollowedReleases } from "@peated/web/app/(app)/_components/home/homeFollowedReleases.stylex";
import { HomeMemberSummarySection } from "@peated/web/app/(app)/_components/home/homeMemberSummarySection.stylex";
import { PublicHome } from "@peated/web/app/(app)/_components/home/publicHome.stylex";
import { HomePage } from "@peated/web/components/designSystem/patterns/homePage.stylex";
import useAuth from "@peated/web/hooks/useAuth";

type HomeFeed = "friends" | "global";

export function HomePageClient() {
  const { user } = useAuth();
  const [feed, setFeed] = useState<HomeFeed>("friends");

  if (!user) {
    return <PublicHome />;
  }

  return (
    <HomePage
      activity={<HomeActivity filter={feed} />}
      critics={<HomeCriticReviews />}
      currentFeed={feed}
      feeds={[
        { label: "Friends", value: "friends" },
        { label: "Global", value: "global" },
      ]}
      onFeedChange={(nextFeed) => {
        if (nextFeed === "friends" || nextFeed === "global") {
          setFeed(nextFeed);
        }
      }}
      rail={
        <>
          <HomeMemberSummarySection />
          <HomeFollowedReleases />
        </>
      }
      signedIn
    />
  );
}
