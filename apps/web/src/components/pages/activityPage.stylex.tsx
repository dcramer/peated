import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { ButtonLink, EmptyState, TextLink } from "..";
import { colors, fonts, space } from "../../styles/tokens.stylex";
import { CommunityFeed, type CommunityFeedItem } from "../communityFeed.stylex";
import { PageColumns, PageHeader } from "./pageLayout.stylex";
import { RailListSection } from "./railListSection.stylex";

/** Keeps the title and feed selection aligned with the activity column. */
export function ActivityPage({
  items,
  note,
  selector,
}: {
  items: readonly CommunityFeedItem[];
  note?: string;
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
              <p {...stylex.props(styles.railText)}>
                Choose a bottle, add a rating, and keep a note of what you
                tasted.
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
            <RailListSection heading="Tastings and reviews">
              <p {...stylex.props(styles.railText)}>
                Tastings use five ratings, from Mediocre to Unicorn. Reviews can
                include a score out of 100.
              </p>
              <TextLink href="/about/ratings">How ratings work →</TextLink>
            </RailListSection>
          </div>
        }
      >
        {note ? <p {...stylex.props(styles.note)}>{note}</p> : null}
        {items.length ? (
          <CommunityFeed
            ariaLabel="Latest tastings and reviews"
            items={items}
            limit={20}
          />
        ) : (
          <EmptyState heading="Nothing here yet">
            New tastings and reviews will appear here.
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
    fontFamily: fonts.reading,
    fontSize: "15px",
    lineHeight: 1.6,
  },
  note: {
    marginTop: space.x4,
    marginBottom: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.5,
  },
});
