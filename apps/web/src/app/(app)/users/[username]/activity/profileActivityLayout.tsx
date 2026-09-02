"use client";

import type { ReactNode } from "react";

import { LoadingList } from "@peated/web/components";
import { PageColumns } from "@peated/web/components/pages/pageLayout.stylex";
import { useProfile } from "../profileContext";
import { getProfileLoadingRows } from "../profileLoading";

export function ProfileActivityLayout({ children }: { children: ReactNode }) {
  const { user } = useProfile();

  return (
    <PageColumns>
      <section aria-label={`${user.username}'s activity`}>{children}</section>
    </PageColumns>
  );
}

export function ProfileActivityLoading() {
  const { user } = useProfile();
  const totalActivity = user.stats.tastings + user.stats.library.total;

  return (
    <ProfileActivityLayout>
      <LoadingList
        label="Loading member activity"
        rows={getProfileLoadingRows(totalActivity)}
      />
    </ProfileActivityLayout>
  );
}
