import * as stylex from "@stylexjs/stylex";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  BottleList,
  type BottleListItem,
  ItemList,
  ItemRow,
  LocationPreviewCard,
  type LocationPreviewCardProps,
} from "..";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../styles/tokens.stylex";

const COMPACT = "@media (max-width: 639px)";
const NARROW = "@media (min-width: 640px) and (max-width: 899px)";

function HomeModuleHeading({
  action,
  detail,
  title,
}: {
  action?: ReactNode;
  detail?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.heading)}>
      <div {...stylex.props(styles.headingLine)}>
        <h2 {...stylex.props(styles.title)}>{title}</h2>
        {action}
      </div>
      {detail ? <div {...stylex.props(styles.detail)}>{detail}</div> : null}
    </div>
  );
}

/** Shows bottles with published median scores in API rank order. */
export function HomeHighestRated({
  bottles,
  totalRated,
}: {
  bottles: readonly BottleListItem[];
  totalRated: number;
}) {
  return (
    <section {...stylex.props(styles.section)}>
      <HomeModuleHeading
        action={
          <Link
            href="/bottles?sort=-score&minScore=0"
            {...stylex.props(styles.moreLink)}
          >
            All {totalRated.toLocaleString("en-US")} rated{" "}
            <span aria-hidden="true">→</span>
          </Link>
        }
        title="Highest rated"
      />
      <div {...stylex.props(styles.rows)}>
        <BottleList ariaLabel="Highest rated bottles" items={bottles} />
      </div>
    </section>
  );
}

/** Shows bottles with known release years in API release order. */
export function HomeLatestReleases({
  bottles,
  seeAllHref,
  title,
}: {
  bottles: readonly BottleListItem[];
  seeAllHref: string;
  title: string;
}) {
  return (
    <section {...stylex.props(styles.section)}>
      <HomeModuleHeading
        action={
          <Link href={seeAllHref} {...stylex.props(styles.moreLink)}>
            View all <span aria-hidden="true">→</span>
          </Link>
        }
        title={title}
      />
      <div {...stylex.props(styles.rows)}>
        <BottleList ariaLabel={title} items={bottles} />
      </div>
    </section>
  );
}

export function HomeActivityFeed({ children }: { children: ReactNode }) {
  return (
    <section {...stylex.props(styles.section)}>
      <HomeModuleHeading
        action={
          <Link href="/activity" {...stylex.props(styles.moreLink)}>
            View all <span aria-hidden="true">→</span>
          </Link>
        }
        title="Activity"
      />
      <div {...stylex.props(styles.rows)}>{children}</div>
    </section>
  );
}

function formatBottleCount(count: number) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "bottle" : "bottles"}`;
}

/** Keeps homepage and country overview location previews identical. */
export function HomeRegionGrid({
  regions,
}: {
  regions: readonly LocationPreviewCardProps[];
}) {
  return (
    <div {...stylex.props(styles.regionGrid)}>
      {regions.map((region) => (
        <LocationPreviewCard key={region.href} {...region} />
      ))}
    </div>
  );
}

export function HomeOrigins({
  countries,
  remainingCountries,
  regions,
}: {
  countries: readonly LocationPreviewCardProps[];
  remainingCountries?: { count: number; totalBottles: number };
  regions: readonly LocationPreviewCardProps[];
}) {
  return (
    <section {...stylex.props(styles.section)}>
      <HomeModuleHeading
        action={
          <Link href="/locations" {...stylex.props(styles.moreLink)}>
            Open the map <span aria-hidden="true">→</span>
          </Link>
        }
        title="Browse by origin"
      />
      <p {...stylex.props(styles.originIntro)}>
        Mostly Scotch, a good deal of American, and a growing amount of
        everything else.
      </p>
      <div {...stylex.props(styles.countryGrid)}>
        {countries.map((country) => (
          <LocationPreviewCard key={country.href} {...country} />
        ))}
        {remainingCountries && remainingCountries.count > 0 ? (
          <LocationPreviewCard
            href="/locations"
            name="Everywhere else"
            totalBottles={remainingCountries.totalBottles}
            visual={{ kind: "count", value: remainingCountries.count }}
          />
        ) : null}
      </div>
      {regions.length ? (
        <>
          <div {...stylex.props(styles.regionHeading)}>By region</div>
          <HomeRegionGrid regions={regions} />
        </>
      ) : null}
    </section>
  );
}

export type HomeDistillery = {
  href: string;
  location?: string;
  name: string;
  totalBottles: number;
};

export function HomeDistilleries({
  distilleries,
  totalDistilleries,
}: {
  distilleries: readonly HomeDistillery[];
  totalDistilleries?: number;
}) {
  return (
    <section {...stylex.props(styles.section)}>
      <HomeModuleHeading title="Distilleries" />
      <div {...stylex.props(styles.distilleries)}>
        <ItemList ariaLabel="Distilleries">
          {distilleries.map((distillery) => (
            <ItemRow
              href={distillery.href}
              key={distillery.href}
              metadata={
                <>
                  {distillery.location ? `${distillery.location} · ` : null}
                  {formatBottleCount(distillery.totalBottles)}
                </>
              }
              title={distillery.name}
            />
          ))}
        </ItemList>
      </div>
      <div {...stylex.props(styles.distilleryLink)}>
        <Link href="/distillers" {...stylex.props(styles.moreLink)}>
          {totalDistilleries === undefined
            ? "View all distilleries"
            : `View ${totalDistilleries.toLocaleString("en-US")} distilleries`}{" "}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

export function HomeContributionPrompt({
  primaryAction,
  secondaryAction,
}: {
  primaryAction: ReactNode;
  secondaryAction: ReactNode;
}) {
  return (
    <section {...stylex.props(styles.prompt)}>
      <h2 {...stylex.props(styles.promptTitle)}>Missing a bottle?</h2>
      <p {...stylex.props(styles.promptCopy)}>
        Add it. Cask number, vintage, ABV, finish—as much as the label tells
        you.
      </p>
      <div {...stylex.props(styles.promptActions)}>
        {primaryAction}
        {secondaryAction}
      </div>
    </section>
  );
}

const styles = stylex.create({
  section: {
    minWidth: 0,
  },
  heading: {
    display: "flex",
    minWidth: 0,
    alignItems: "flex-start",
    flexDirection: "column",
    rowGap: space.x2,
  },
  headingLine: {
    display: "flex",
    width: "100%",
    minWidth: 0,
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x3,
  },
  title: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "24px",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
  },
  detail: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.06em",
    lineHeight: 1.4,
    textTransform: "uppercase",
  },
  rows: {
    marginTop: space.x2,
  },
  originIntro: {
    maxWidth: "640px",
    marginTop: space.x2,
    marginBottom: 0,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "15px",
    lineHeight: 1.5,
  },
  regionHeading: {
    marginTop: space.x6,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    lineHeight: 1.4,
    textTransform: "uppercase",
  },
  regionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "6px",
    marginTop: space.x2,
    [NARROW]: {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    [COMPACT]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  countryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "6px",
    marginTop: space.x4,
    [NARROW]: {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    [COMPACT]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  distilleries: {
    marginTop: "14px",
  },
  moreLink: {
    display: "inline-block",
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    color: {
      default: colors.accent,
      ":hover": colors.accentDeep,
      ":active": colors.accentDeep,
    },
    fontFamily: fonts.display,
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.2,
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
    },
    textDecorationThickness: "1px",
    textUnderlineOffset: "2px",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  distilleryLink: {
    marginTop: space.x3,
  },
  prompt: {
    paddingTop: "18px",
    paddingBottom: "18px",
    backgroundColor: "transparent",
  },
  promptTitle: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  promptCopy: {
    margin: 0,
    marginTop: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.5,
  },
  promptActions: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginTop: space.x3,
    flexWrap: "wrap",
  },
});
