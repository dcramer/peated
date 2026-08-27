import * as stylex from "@stylexjs/stylex";
import { Camera, Search } from "lucide-react";
import type { ReactNode } from "react";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../../styles/tokens.stylex";
import {
  Button,
  ButtonLink,
  CountChip,
  VerdictDistribution,
} from "../components";

export type QuickTastingBottle = {
  href: string;
  name: string;
};

export type QuickTastingPromptProps = {
  bottles?: readonly QuickTastingBottle[];
  scanHref: string;
};

/** Starts the existing tasting workflow with either a query or a known bottle. */
export function QuickTastingPrompt({
  bottles = [],
  scanHref,
}: QuickTastingPromptProps) {
  return (
    <section
      aria-labelledby="quick-tasting-heading"
      {...stylex.props(styles.prompt)}
    >
      <div {...stylex.props(styles.promptHeading)}>
        <h1 id="quick-tasting-heading" {...stylex.props(styles.promptTitle)}>
          What are you drinking?
        </h1>
        <span {...stylex.props(styles.promptHint)}>3 taps to log</span>
      </div>
      <form action="/search" method="get" {...stylex.props(styles.searchForm)}>
        <input name="intent" type="hidden" value="tasting" />
        <Search aria-hidden="true" size={16} strokeWidth={1.75} />
        <label
          htmlFor="home-tasting-query"
          {...stylex.props(styles.visuallyHidden)}
        >
          Search for a bottle to log
        </label>
        <input
          autoComplete="off"
          id="home-tasting-query"
          name="q"
          placeholder="Search a bottle to log"
          type="search"
          {...stylex.props(styles.searchInput)}
        />
        <Button size="sm" type="submit" variant="text">
          Search
        </Button>
        <ButtonLink href={scanHref} size="sm" variant="text">
          <Camera aria-hidden="true" size={15} strokeWidth={1.75} />
          Scan a label
        </ButtonLink>
      </form>
      {bottles.length ? (
        <div {...stylex.props(styles.shelf)}>
          <div {...stylex.props(styles.shelfBottles)}>
            {bottles.map((bottle) => (
              <a
                href={bottle.href}
                key={bottle.href}
                {...stylex.props(styles.bottleChip)}
              >
                {bottle.name}
              </a>
            ))}
          </div>
          <span {...stylex.props(styles.shelfLabel)}>on your shelf</span>
        </div>
      ) : null}
    </section>
  );
}

export type MemberRecordFact = {
  label: string;
  value: number;
};

export type MemberRecordSummaryProps = {
  facts: readonly [MemberRecordFact, MemberRecordFact, MemberRecordFact];
  ratings: { pass: number; savor: number; sip: number };
  totalTastings: number;
};

/** Summarizes the signed-in member's existing tasting and collection record. */
export function MemberRecordSummary({
  facts,
  ratings,
  totalTastings,
}: MemberRecordSummaryProps) {
  return (
    <section
      aria-labelledby="member-record-heading"
      {...stylex.props(styles.widget)}
    >
      <div {...stylex.props(styles.widgetHeading)}>
        <h2 id="member-record-heading" {...stylex.props(styles.widgetTitle)}>
          Your record
        </h2>
        <CountChip count={totalTastings} />
      </div>
      <div {...stylex.props(styles.recordPanel)}>
        <div {...stylex.props(styles.recordTotal)}>
          <strong {...stylex.props(styles.recordTotalValue)}>
            {totalTastings.toLocaleString("en-US")}
          </strong>
          <span {...stylex.props(styles.recordTotalLabel)}>
            tastings you have recorded
          </span>
        </div>
        <div {...stylex.props(styles.recordDistribution)}>
          <VerdictDistribution {...ratings} />
        </div>
        <dl {...stylex.props(styles.recordFacts)}>
          {facts.map((fact) => (
            <div key={fact.label} {...stylex.props(styles.recordFact)}>
              <dd {...stylex.props(styles.recordFactValue)}>
                {fact.value.toLocaleString("en-US")}
              </dd>
              <dt {...stylex.props(styles.recordFactLabel)}>{fact.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function HomeWidgetLoading({ children }: { children: ReactNode }) {
  return (
    <div aria-busy="true" {...stylex.props(styles.loading)}>
      {children}
    </div>
  );
}

const COMPACT = "@media (max-width: 639px)";

const styles = stylex.create({
  prompt: {
    paddingTop: "22px",
    paddingRight: space.x6,
    paddingBottom: "22px",
    paddingLeft: space.x6,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
    [COMPACT]: {
      paddingTop: space.x4,
      paddingRight: space.x4,
      paddingBottom: space.x4,
      paddingLeft: space.x4,
    },
  },
  promptHeading: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x3,
  },
  promptTitle: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  promptHint: {
    flexShrink: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.3,
  },
  searchForm: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    minWidth: 0,
    minHeight: controlMetrics.controlHeightLarge,
    alignItems: "center",
    gap: space.x2,
    marginTop: space.x3,
    paddingRight: space.x2,
    paddingLeft: "14px",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.inset,
    color: colors.inkMuted,
    boxShadow: {
      default: "none",
      ":focus-within": effects.focusRing,
    },
    [COMPACT]: {
      alignItems: "stretch",
      flexWrap: "wrap",
      paddingTop: space.x2,
      paddingBottom: space.x2,
    },
  },
  searchInput: {
    minWidth: "120px",
    flex: 1,
    height: "40px",
    padding: 0,
    borderWidth: 0,
    outline: "none",
    backgroundColor: "transparent",
    color: colors.ink,
    fontFamily: fonts.data,
    fontSize: "12px",
    lineHeight: 1.4,
    boxShadow: "none",
    "::placeholder": {
      color: colors.inkMuted,
      opacity: 1,
    },
  },
  shelf: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
    marginTop: space.x3,
    flexWrap: "wrap",
  },
  shelfBottles: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  },
  bottleChip: {
    paddingTop: "7px",
    paddingRight: "11px",
    paddingBottom: "7px",
    paddingLeft: "11px",
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    backgroundColor: colors.inset,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: 1.2,
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  shelfLabel: {
    paddingRight: space.x1,
    paddingLeft: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.3,
  },
  widget: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x3,
  },
  widgetHeading: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  widgetTitle: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  recordPanel: {
    paddingTop: "22px",
    paddingRight: space.x6,
    paddingBottom: "22px",
    paddingLeft: space.x6,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  recordTotal: {
    display: "flex",
    alignItems: "baseline",
    gap: "6px",
  },
  recordTotalValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "34px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 1,
  },
  recordTotalLabel: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.35,
  },
  recordDistribution: {
    marginTop: space.x4,
  },
  recordFacts: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: space.x3,
    margin: 0,
    marginTop: space.x4,
    padding: 0,
  },
  recordFact: {
    minWidth: 0,
  },
  recordFactValue: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
  },
  recordFactLabel: {
    overflow: "hidden",
    marginTop: "2px",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "9px",
    letterSpacing: "0.06em",
    lineHeight: 1.3,
    textOverflow: "ellipsis",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  loading: {
    minHeight: "240px",
  },
  visuallyHidden: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    margin: "-1px",
    padding: 0,
    borderWidth: 0,
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
  },
});
