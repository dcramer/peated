"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { CommunityFeedLoading } from "@peated/web/components/communityFeed.stylex";
import { FilterRailLoading } from "@peated/web/components/filterPanel.stylex";
import {
  ListToolbarLoading,
  type ListView,
} from "@peated/web/components/lists.stylex";
import { PageColumns } from "@peated/web/components/pages/pageLayout.stylex";
import { TastingTableLoading } from "@peated/web/components/tastingTable.stylex";
import { profileBottleSearchCopy } from "../profileBottleSearch.stylex";
import { useProfile } from "../profileContext";
import { getProfileLoadingRows } from "../profileLoading";
import { getProfileListView } from "../profileQueries";

export function ProfileTastingsLayout({
  children,
  rail,
}: {
  children: ReactNode;
  rail?: ReactNode;
}) {
  return <PageColumns rail={rail}>{children}</PageColumns>;
}

/**
 * Reserves the toolbar and the list or table while tastings load, at the
 * finished sizes, so the results replace it without moving the page.
 */
export function ProfileTastingsResultsLoading({ view }: { view: ListView }) {
  const { user } = useProfile();
  const rows = getProfileLoadingRows(user.stats.tastings);

  return (
    <>
      <ListToolbarLoading mobileActionLayout="pageColumns" view />
      {view === "table" ? (
        <TastingTableLoading label="Loading member tastings" rows={rows} />
      ) : (
        <CommunityFeedLoading
          label="Loading member tastings"
          rows={rows}
          showActor={false}
        />
      )}
    </>
  );
}

/** Reserves the filter rail while counts load. */
export function ProfileTastingsFiltersLoading({
  hasCountry,
}: {
  hasCountry: boolean;
}) {
  return (
    <FilterRailLoading
      groups={[
        { label: "Rating", rows: 5 },
        { label: "Age", rows: 6, summary: true },
        { label: "Countries", rows: 4 },
        // Regions appear only after a country is picked.
        ...(hasCountry ? [{ label: "Regions", rows: 3 }] : []),
        { label: "Distilleries", rows: 5 },
      ]}
      searchLabel={profileBottleSearchCopy.tastings.label}
    />
  );
}

/** Keeps the toolbar, results, and filter rail in place while tastings load. */
export function ProfileTastingsLoading() {
  const searchParams = useSearchParams();
  const hasCountry = Boolean(searchParams.get("country"));

  return (
    <div aria-busy="true" aria-label="Loading member tastings" role="status">
      <ProfileTastingsLayout
        rail={<ProfileTastingsFiltersLoading hasCountry={hasCountry} />}
      >
        <ProfileTastingsResultsLoading
          view={getProfileListView(searchParams)}
        />
      </ProfileTastingsLayout>
    </div>
  );
}
