"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ButtonLink } from "@peated/web/components/designSystem/components";
import { HomePage } from "@peated/web/components/designSystem/patterns/homePage.stylex";
import { HomeDatabaseOverview } from "@peated/web/components/designSystem/patterns/homeSections.stylex";
import { HomeActivity } from "@peated/web/components/designSystem/product/homeActivity.stylex";
import { HomeCriticReviews } from "@peated/web/components/designSystem/product/homeCriticReviews.stylex";
import { HomeFollowedReleases } from "@peated/web/components/designSystem/product/homeFollowedReleases.stylex";
import { HomeMemberRecord } from "@peated/web/components/designSystem/product/homeMemberRecord.stylex";
import { HomeQuickTasting } from "@peated/web/components/designSystem/product/homeQuickTasting.stylex";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";

type HomeFeed = "friends" | "global";

export function HomePageClient() {
  const { user } = useAuth();
  const [feed, setFeed] = useState<HomeFeed>("friends");

  if (!user) {
    return <PublicHomePage />;
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
      prompt={<HomeQuickTasting />}
      rail={
        <>
          <HomeMemberRecord />
          <HomeFollowedReleases />
        </>
      }
      signedIn
    />
  );
}

function PublicHomePage() {
  const orpc = useORPC();
  const stats = useQuery(orpc.stats.queryOptions());

  return (
    <HomePage
      description="Peated is a whisky database: bottlings down to the cask, critic scores kept per release, and your own tastings and collection alongside them."
      facts={[
        {
          label: "Bottles",
          value: stats.data?.totalBottles.toLocaleString("en-US") ?? "–",
        },
        {
          label: "Distilleries",
          value: stats.data?.totalDistilleries.toLocaleString("en-US") ?? "–",
        },
        {
          label: "Tastings recorded",
          value: stats.data?.totalTastings.toLocaleString("en-US") ?? "–",
        },
      ]}
      overview={
        <HomeDatabaseOverview
          principles={[
            "Anyone can record a missing bottling, including its cask, vintage, strength, and finish.",
            "Critic scores stay attached to their published release, beside the community view rather than blended into it.",
            "Your tastings and library remain your record, and you can export them at any time.",
          ]}
          record={{
            description:
              "The trade score stays in plain ink, the community verdict stays distinct, and the tastings beneath them preserve what each person actually recorded.",
            detail: "Islay · single malt",
            id: "B00872",
            specs: [
              { label: "ABV", value: "43.0" },
              { label: "Age", value: "16" },
              { label: "Critic", value: "88" },
              { label: "Savor", value: "62%" },
            ],
            title: "Lagavulin 16",
          }}
        />
      }
      primaryAction={
        <ButtonLink href="/register" size="lg" variant="accent">
          Create an account
        </ButtonLink>
      }
      secondaryAction={
        <ButtonLink href="/bottles" size="lg" variant="tonal">
          Browse the database
        </ButtonLink>
      }
      signedIn={false}
      title="Every bottle, every review, in one place."
    />
  );
}
