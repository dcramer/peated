import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { ButtonLink, EmptyState, TextLink } from "..";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, space } from "../../styles/tokens.stylex";
import { CommunityFeed, type CommunityFeedItem } from "../communityFeed.stylex";
import {
  BottleRailSection,
  type BottleRailItem,
} from "./bottleRailSection.stylex";
import { PageColumns, PageHeader } from "./pageLayout.stylex";
import { RailListSection } from "./railListSection.stylex";

/** Keeps the title and feed selection aligned with the activity column. */
export function ActivityPage({
  items,
  note,
  selector,
  libraryBottles = [],
  libraryHref,
}: {
  items: readonly CommunityFeedItem[];
  note?: string;
  libraryBottles?: readonly BottleRailItem[];
  libraryHref?: string;
  selector: ReactNode;
}) {
  return (
    <div>
      <PageColumns
        header={
          <PageHeader
            actions={selector}
            actionsPosition="inline"
            title="Activity"
          />
        }
        rail={
          <div {...stylex.props(styles.rail)}>
            <RailListSection heading="What have you tried?">
              <p {...stylex.props(foundationStyles.body, styles.railText)}>
                Add a rating and a few notes to remember what you tasted.
              </p>
              <div>
                <ButtonLink
                  href="/addBottle?intent=tasting"
                  size="sm"
                  variant="accent"
                >
                  Add a tasting
                </ButtonLink>
              </div>
            </RailListSection>
            {libraryBottles.length ? (
              <BottleRailSection
                heading="From your library"
                intro="A few bottles you haven’t tasted on Peated."
                items={libraryBottles}
                moreHref={libraryHref}
                moreLabel="View library →"
              />
            ) : null}
            <TextLink href="/about/ratings">How ratings work →</TextLink>
          </div>
        }
      >
        {note ? (
          <p {...stylex.props(foundationStyles.metadata, styles.note)}>
            {note}
          </p>
        ) : null}
        {items.length ? (
          <CommunityFeed ariaLabel="Latest activity" items={items} limit={20} />
        ) : (
          <EmptyState heading="Nothing here yet">
            Tastings, reviews, and library additions will appear here.
          </EmptyState>
        )}
      </PageColumns>
    </div>
  );
}

const styles = stylex.create({
  rail: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x8,
    paddingTop: "14px",
  },
  railText: {
    margin: 0,
    color: colors.inkMuted,
  },
  note: {
    marginTop: space.x4,
    marginBottom: space.x2,
    color: colors.inkMuted,
  },
});
