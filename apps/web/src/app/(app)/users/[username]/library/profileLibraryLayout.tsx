"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { FilterRailLoading } from "@peated/web/components/filterPanel.stylex";
import { LibraryListLoading } from "@peated/web/components/libraryList.stylex";
import { LibraryTableLoading } from "@peated/web/components/libraryTable.stylex";
import {
  ListToolbarLoading,
  type ListView,
} from "@peated/web/components/lists.stylex";
import { PageColumns } from "@peated/web/components/pages/pageLayout.stylex";
import { profileBottleSearchCopy } from "../profileBottleSearch.stylex";
import { useProfile } from "../profileContext";
import { getProfileLoadingRows } from "../profileLoading";
import { getProfileListView } from "../profileQueries";

export function ProfileLibraryLayout({
  children,
  rail,
}: {
  children: ReactNode;
  rail: ReactNode;
}) {
  return <PageColumns rail={rail}>{children}</PageColumns>;
}

/** Keeps the toolbar, Library rows, and filter rail stable while data loads. */
export function ProfileLibraryLoading() {
  const searchParams = useSearchParams();

  return (
    <div aria-busy="true" aria-label="Loading member library" role="status">
      <ProfileLibraryLayout rail={<ProfileLibraryFiltersLoading />}>
        <ProfileLibraryResultsLoading view={getProfileListView(searchParams)} />
      </ProfileLibraryLayout>
    </div>
  );
}

/**
 * Reserves the toolbar and the list or table while Library bottles load, at
 * the finished sizes, so the results replace it without moving the page.
 */
export function ProfileLibraryResultsLoading({ view }: { view: ListView }) {
  const { isCurrentUser, user } = useProfile();
  const rows = getProfileLoadingRows(user.stats.library.total);

  return (
    <>
      <ListToolbarLoading mobileAction view />
      {view === "table" ? (
        <LibraryTableLoading
          actions={isCurrentUser}
          label="Loading library bottles"
          rows={rows}
        />
      ) : (
        <LibraryListLoading label="Loading library bottles" rows={rows} />
      )}
    </>
  );
}

/** Reserves the filter rail while counts load. */
export function ProfileLibraryFiltersLoading() {
  return (
    <FilterRailLoading
      groups={[
        { label: "Status", rows: 4 },
        { label: "Age", rows: 6, summary: true },
        { label: "Brands", rows: 5 },
        { label: "Distilleries", rows: 5 },
      ]}
      searchLabel={profileBottleSearchCopy.library.label}
    />
  );
}
