"use client";

import type { ReactNode } from "react";

import {
  LoadingList,
  LoadingPlaceholder,
} from "@peated/web/components/feedback.stylex";
import { PageColumns } from "@peated/web/components/pages/pageLayout.stylex";
import { useProfile } from "../profileContext";
import { getProfileLoadingRows } from "../profileLoading";

export function ProfileTastingsLayout({
  children,
  mobileFilters,
  rail,
}: {
  children: ReactNode;
  mobileFilters?: ReactNode;
  rail?: ReactNode;
}) {
  return (
    <>
      {mobileFilters}
      <PageColumns rail={rail}>{children}</PageColumns>
    </>
  );
}

/** Keeps the toolbar and filter rail in place while tastings load. */
export function ProfileTastingsLoading() {
  const { user } = useProfile();

  return (
    <div aria-busy="true" aria-label="Loading member tastings" role="status">
      <ProfileTastingsLayout
        rail={
          <div aria-hidden="true">
            <LoadingPlaceholder preset="heading" />
            <LoadingList label="Loading tasting filters" rows={4} />
          </div>
        }
      >
        <div aria-hidden="true">
          <LoadingPlaceholder preset="heading" />
          <LoadingList
            label="Loading member tastings"
            rows={getProfileLoadingRows(user.stats.tastings)}
          />
        </div>
      </ProfileTastingsLayout>
    </div>
  );
}
