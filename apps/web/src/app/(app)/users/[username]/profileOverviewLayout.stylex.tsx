"use client";

import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  FactList,
  type FactListItem,
  LoadingList,
  LoadingPlaceholder,
  SectionHeading,
  TextLink,
} from "@peated/web/components";
import {
  PageColumns,
  RailSection,
} from "@peated/web/components/pages/pageLayout.stylex";
import { colors, space } from "../../../../styles/tokens.stylex";
import { useProfile } from "./profileContext";

const loadingDelays = [0, 1, 2, 3, 4] as const;

export function ProfileOverviewLayout({
  main,
  rail,
}: {
  main: ReactNode;
  rail: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.overview)}>
      <PageColumns rail={rail} railBehavior="stack">
        <div {...stylex.props(styles.main)}>{main}</div>
      </PageColumns>
    </div>
  );
}

export function ProfileActivitySection({
  children,
  username,
}: {
  children: ReactNode;
  username: string;
}) {
  return (
    <section aria-label="Recent activity">
      <div {...stylex.props(styles.sectionHeader)}>
        <SectionHeading>Recent activity</SectionHeading>
        <TextLink href={`/users/${username}/activity`} size="sm">
          View all
        </TextLink>
      </div>
      {children}
    </section>
  );
}

/** Keeps the Overview page size stable while its data loads. */
export function ProfileOverviewLoading() {
  const { user } = useProfile();
  const factLabels = user.createdAt
    ? ["Tastings", "Bottles tasted", "In library", "Catalog changes", "Joined"]
    : ["Tastings", "Bottles tasted", "In library", "Catalog changes"];
  const facts: [FactListItem, ...FactListItem[]] = [
    {
      label: "Tastings",
      value: <LoadingPlaceholder preset="metadata" />,
    },
    ...factLabels.slice(1).map((label, index) => ({
      label,
      value: (
        <LoadingPlaceholder
          delay={loadingDelays[(index + 1) % loadingDelays.length]}
          preset="metadata"
        />
      ),
    })),
  ];

  return (
    <div aria-busy="true" aria-label="Loading profile overview" role="status">
      <ProfileOverviewLayout
        main={
          <>
            <FactList facts={facts} layout="grid" />
            <ProfileActivitySection username={user.username}>
              <LoadingList label="Loading recent member activity" rows={4} />
            </ProfileActivitySection>
          </>
        }
        rail={
          <div aria-hidden="true" {...stylex.props(styles.loadingRail)}>
            <LoadingRailSection />
            <LoadingRailSection />
            <LoadingRailSection />
          </div>
        }
      />
    </div>
  );
}

function LoadingRailSection() {
  return (
    <RailSection heading={<LoadingPlaceholder preset="heading" />}>
      <LoadingList label="Loading profile details" rows={3} />
    </RailSection>
  );
}

const styles = stylex.create({
  overview: {
    minWidth: 0,
  },
  main: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x8,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x4,
    paddingBottom: space.x3,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.sectionRule,
  },
  loadingRail: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x8,
  },
});
