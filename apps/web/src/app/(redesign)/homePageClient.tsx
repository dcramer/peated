"use client";

import { useState } from "react";

import { HomePage } from "@peated/web/components/designSystem/patterns/homePage.stylex";
import { HomeActivity } from "@peated/web/components/designSystem/product/homeActivity.stylex";
import { HomeCriticReviews } from "@peated/web/components/designSystem/product/homeCriticReviews.stylex";
import { HomeFollowedReleases } from "@peated/web/components/designSystem/product/homeFollowedReleases.stylex";
import { HomeMemberSummarySection } from "@peated/web/components/designSystem/product/homeMemberSummarySection.stylex";
import {
  PublicHome,
  type PublicHomeInitialData,
} from "@peated/web/components/designSystem/product/publicHome.stylex";
import useAuth from "@peated/web/hooks/useAuth";

type HomeFeed = "friends" | "global";

export function HomePageClient({
  publicHomeInitialData,
}: {
  publicHomeInitialData?: PublicHomeInitialData;
}) {
  const { user } = useAuth();
  const [feed, setFeed] = useState<HomeFeed>("friends");

  if (!user) {
    return <PublicHome initialData={publicHomeInitialData} />;
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
