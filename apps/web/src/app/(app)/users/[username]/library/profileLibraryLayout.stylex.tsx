"use client";

import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { LoadingList, LoadingPlaceholder } from "@peated/web/components";
import { PageColumns } from "@peated/web/components/pages/pageLayout.stylex";
import { colors, fonts, space } from "../../../../../styles/tokens.stylex";
import { useProfile } from "../profileContext";
import { getProfileLoadingRows } from "../profileLoading";

const NARROW = "@media (max-width: 759px)";

export function ProfileLibraryLayout({
  children,
  mobileFilters,
  rail,
}: {
  children: ReactNode;
  mobileFilters: ReactNode;
  rail: ReactNode;
}) {
  return (
    <>
      {mobileFilters}
      <PageColumns rail={rail}>{children}</PageColumns>
    </>
  );
}

/** Keeps both Library filter layouts stable while data loads. */
export function ProfileLibraryLoading() {
  const { user } = useProfile();

  return (
    <div aria-busy="true" aria-label="Loading member library" role="status">
      <ProfileLibraryLayout
        mobileFilters={
          <div aria-hidden="true" {...stylex.props(styles.mobileFilters)}>
            Filter library
          </div>
        }
        rail={
          <div aria-hidden="true" {...stylex.props(styles.loadingRail)}>
            <LoadingPlaceholder preset="heading" />
            <LoadingList label="Loading library filters" rows={4} />
          </div>
        }
      >
        <div aria-hidden="true">
          <div {...stylex.props(styles.loadingCount)}>
            <LoadingPlaceholder preset="heading" />
          </div>
          <LoadingList
            label="Loading library bottles"
            rows={getProfileLoadingRows(user.stats.library.total)}
          />
        </div>
      </ProfileLibraryLayout>
    </div>
  );
}

const styles = stylex.create({
  mobileFilters: {
    display: "none",
    marginBottom: space.x6,
    padding: space.x3,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.3,
    [NARROW]: { display: "block" },
  },
  loadingRail: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x4,
  },
  loadingCount: {
    paddingBottom: space.x3,
  },
});
