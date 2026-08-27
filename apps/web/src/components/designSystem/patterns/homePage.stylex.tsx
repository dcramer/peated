import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { colors, effects, fonts, space } from "../../../styles/tokens.stylex";
import { SectionHeading } from "../components";
import { type SummaryStripCells } from "../components/summaryStrip.stylex";
import { HomeHero } from "./homeSections.stylex";
import { PageColumns } from "./pagePatternShell.stylex";

const NARROW = "@media (max-width: 759px)";

export type SignedInHomePageProps = {
  activity: ReactNode;
  critics?: ReactNode;
  currentFeed: string;
  feedContext?: ReactNode;
  feeds: readonly { label: string; value: string }[];
  onFeedChange: (feed: string) => void;
  prompt: ReactNode;
  rail?: ReactNode;
  signedIn: true;
};

export type SignedOutHomePageProps = {
  description: ReactNode;
  eyebrow?: ReactNode;
  facts?: SummaryStripCells;
  overview?: ReactNode;
  primaryAction: ReactNode;
  secondaryAction: ReactNode;
  signedIn: false;
  title: ReactNode;
};

export type HomePageProps = SignedInHomePageProps | SignedOutHomePageProps;

/** Owns homepage hierarchy and responsive layout, not product data or behavior. */
export function HomePage(props: HomePageProps) {
  if (!props.signedIn) {
    return (
      <>
        <HomeHero
          description={props.description}
          eyebrow={props.eyebrow}
          facts={props.facts}
          primaryAction={props.primaryAction}
          secondaryAction={props.secondaryAction}
          title={props.title}
        />
        {props.overview}
      </>
    );
  }

  return (
    <PageColumns rail={props.rail}>
      <div {...stylex.props(styles.signedInMain)}>
        {props.prompt}
        {props.critics}
        <section
          aria-labelledby="home-feed-heading"
          {...stylex.props(styles.feed)}
        >
          <div {...stylex.props(styles.feedHeading)}>
            <div id="home-feed-heading">
              <SectionHeading>Feed</SectionHeading>
            </div>
            <div aria-label="Activity feed" {...stylex.props(styles.feedTabs)}>
              {props.feeds.map((feed) => {
                const selected = feed.value === props.currentFeed;
                return (
                  <button
                    aria-pressed={selected}
                    key={feed.value}
                    onClick={() => props.onFeedChange(feed.value)}
                    type="button"
                    {...stylex.props(
                      styles.feedTab,
                      selected && styles.currentFeedTab,
                    )}
                  >
                    {feed.label}
                  </button>
                );
              })}
            </div>
            {props.feedContext ? (
              <span {...stylex.props(styles.feedContext)}>
                {props.feedContext}
              </span>
            ) : null}
          </div>
          <div {...stylex.props(styles.activity)}>{props.activity}</div>
        </section>
      </div>
    </PageColumns>
  );
}

const styles = stylex.create({
  signedInMain: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x6,
  },
  feed: {
    minWidth: 0,
  },
  feedHeading: {
    display: "flex",
    minHeight: "34px",
    alignItems: "center",
    gap: space.x4,
    flexWrap: "wrap",
  },
  feedTabs: {
    display: "flex",
    alignItems: "center",
    gap: space.x4,
  },
  feedTab: {
    minHeight: "30px",
    padding: 0,
    borderWidth: 0,
    outline: "none",
    backgroundColor: "transparent",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: 1.2,
    cursor: "pointer",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  currentFeedTab: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "13px",
    fontWeight: 700,
    boxShadow: `inset 0 -2px 0 ${colors.accent}`,
  },
  feedContext: {
    marginLeft: "auto",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.3,
  },
  activity: {
    marginTop: space.x3,
  },
});
