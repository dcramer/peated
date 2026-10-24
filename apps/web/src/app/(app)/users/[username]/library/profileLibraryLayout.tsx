"use client";

import type { ReactNode } from "react";

import { LoadingList } from "@peated/web/components/feedback.stylex";
import { ListToolbarLoading } from "@peated/web/components/lists.stylex";
import { MemberListFiltersLoading } from "@peated/web/components/pages/memberListFilters.stylex";
import { PageColumns } from "@peated/web/components/pages/pageLayout.stylex";
import { profileBottleSearchCopy } from "../profileBottleSearch.stylex";
import { useProfile } from "../profileContext";
import { getProfileLoadingRows } from "../profileLoading";

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
  const { user } = useProfile();

  return (
    <div aria-busy="true" aria-label="Loading member library" role="status">
      <ProfileLibraryLayout rail={<ProfileLibraryFiltersLoading />}>
        <ProfileLibraryResultsLoading
          rows={getProfileLoadingRows(user.stats.library.total)}
        />
      </ProfileLibraryLayout>
    </div>
  );
}

/** Reserves the Library toolbar and rows at their finished sizes. */
export function ProfileLibraryResultsLoading({
  rows,
}: {
  rows: Parameters<typeof LoadingList>[0]["rows"];
}) {
  return (
    <>
      <ListToolbarLoading mobileActionLayout="pageColumns" />
      <LoadingList label="Loading library bottles" rows={rows} />
    </>
  );
}

function ProfileLibraryFiltersLoading() {
  return (
    <MemberListFiltersLoading
      groups={[
        { label: "Status", rows: 4 },
        { label: "Brands", rows: 5 },
        { label: "Distilleries", rows: 5 },
      ]}
      searchLabel={profileBottleSearchCopy.library.label}
    />
  );
}
