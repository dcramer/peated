"use client";

import type { ReactNode } from "react";

import { LoadingList } from "@peated/web/components";
import {
  PageColumns,
  RailSection,
} from "@peated/web/components/pages/pageLayout.stylex";
import { useProfile } from "../profileContext";
import { getProfileLoadingRows } from "../profileLoading";

export function ProfileTastingsLayout({
  children,
  rail,
}: {
  children: ReactNode;
  rail?: ReactNode;
}) {
  return <PageColumns rail={rail}>{children}</PageColumns>;
}

export function ProfileTastingsLoading() {
  const { isCurrentUser, user } = useProfile();

  return (
    <ProfileTastingsLayout
      rail={
        <RailSection
          heading={isCurrentUser ? "What you pour" : "What they pour"}
        >
          <LoadingList label="Loading member regions" rows={3} />
        </RailSection>
      }
    >
      <LoadingList
        label="Loading member tastings"
        rows={getProfileLoadingRows(user.stats.tastings)}
      />
    </ProfileTastingsLayout>
  );
}
