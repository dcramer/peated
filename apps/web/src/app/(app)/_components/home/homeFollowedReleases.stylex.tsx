"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { useQuery } from "@tanstack/react-query";

import {
  LoadingList,
  SectionError,
} from "@peated/web/components/designSystem/components";
import { FollowedReleaseList } from "@peated/web/components/designSystem/patterns/homeDiscovery.stylex";
import { HomeSectionLoading } from "@peated/web/components/designSystem/patterns/homeSummary.stylex";
import { useORPC } from "@peated/web/lib/orpc/context";
import { memberHomeQueries } from "@peated/web/lib/orpc/homeQueries";

type Bottle = Outputs["bottles"]["list"]["results"][number];

function getBottleMetadata(bottle: Bottle) {
  return [
    bottle.releaseYear === null ? null : `${bottle.releaseYear} release`,
    bottle.statedAge === null ? null : `${bottle.statedAge} years`,
    bottle.abv === null ? null : `${bottle.abv.toFixed(1)}% ABV`,
  ].filter((value): value is string => Boolean(value));
}

export function HomeFollowedReleases() {
  const orpc = useORPC();
  const releases = useQuery(memberHomeQueries.followedReleases(orpc));

  if (releases.isPending) {
    return (
      <HomeSectionLoading>
        <LoadingList
          label="Loading new releases from distillers you follow"
          rows={3}
        />
      </HomeSectionLoading>
    );
  }

  if (releases.error) {
    return (
      <SectionError
        heading="New releases are unavailable"
        onRetry={() => void releases.refetch()}
      >
        We couldn't load releases from the distillers you follow. Try again.
      </SectionError>
    );
  }

  if (!releases.data.results.length) return null;

  return (
    <FollowedReleaseList
      followedDistillerCount={releases.data.followedDistillerCount ?? 0}
      releases={releases.data.results.map((bottle) => ({
        bottleHref: `/bottles/${bottle.id}`,
        bottleName: bottle.fullName,
        distiller: bottle.distillers[0]?.name ?? bottle.brand.name,
        imageUrl: bottle.imageUrl,
        metadata: getBottleMetadata(bottle),
      }))}
      seeAllHref="/bottles?filter=following&sort=-release"
    />
  );
}
