import * as stylex from "@stylexjs/stylex";
import { SectionHeading } from "./sectionHeading.stylex";

import { foundationStyles } from "../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../styles/tokens.stylex";
import { AppLink } from "./appLink";
import { Avatar } from "./avatar.stylex";
import {
  BottleIdentityRow,
  BottleVisual,
  type BottleIdentityRowProps,
} from "./bottleIdentityRow.stylex";
import { Button, ButtonLink } from "./button.stylex";
import { FloatingPanel } from "./feedback.stylex";
import { MatchedText } from "./matchedText.stylex";
import { MemberStatus } from "./memberStatus.stylex";
import { BottleRatings, type TastingRatingCounts } from "./scoring.stylex";

const COMPACT = "@media (max-width: 559px)";

export type SearchResultRatings = {
  score?: {
    count: number;
    value: number;
  };
  bands?: TastingRatingCounts;
};

export type SearchResultItem = {
  bottle?: Pick<BottleIdentityRowProps, "provenance" | "metadata">;
  href: string;
  id: string;
  isFollowing?: boolean;
  ratings?: SearchResultRatings;
  metadata?: string;
  title: string;
  visual?:
    | {
        kind: "bottle";
        imageUrl?: string | null;
        label: string;
      }
    | {
        kind: "avatar" | "initial";
        fallback: string;
        imageUrl?: string | null;
        label: string;
      };
};

export type SearchResultGroup = {
  id: string;
  items: readonly SearchResultItem[];
  label: string;
  moreHref?: string;
  moreLabel?: string;
  total?: number;
};

export type SearchResultsProps = {
  activeId?: string;
  contribution?: {
    description: string;
    href: string;
    label: string;
  };
  emptyText?: string;
  /** Renders only panel content when the owning typeahead supplies the surface. */
  embedded?: boolean;
  groups: readonly SearchResultGroup[];
  label?: string;
  onItemSelect?: (item: SearchResultItem) => void;
  onRetry?: () => void;
  optionIdPrefix?: string;
  panelId?: string;
  query: string;
  /** Lets a page keep results in document flow instead of a bounded overlay. */
  scroll?: boolean;
  status?: "error" | "ready" | "searching";
  statusText?: string;
  variant?: "database" | "default";
};

/**
 * Presents search results without owning search, ranking, or navigation.
 * Bottle visuals use the standard row thumbnail; member visuals use Avatar.
 * Supply bottle titles from formatBottleDisplayName.
 */
export function SearchResults({
  activeId,
  contribution,
  embedded = false,
  emptyText,
  groups,
  label = "Search results",
  onItemSelect,
  onRetry,
  optionIdPrefix,
  panelId,
  query,
  scroll = true,
  status = "ready",
  statusText,
  variant = "default",
}: SearchResultsProps) {
  const hasResults = groups.some((group) => group.items.length > 0);
  const hasColdLoadingState =
    status === "searching" && !hasResults && !emptyText;
  const hasReplacementLoadingState =
    status === "searching" && !hasColdLoadingState;
  const visibleContribution = hasColdLoadingState ? undefined : contribution;

  const content = (
    <div
      aria-busy={status === "searching" || undefined}
      id={panelId}
      {...stylex.props(styles.panel, !scroll && styles.documentPanel)}
    >
      {hasReplacementLoadingState ? (
        <p aria-live="polite" {...stylex.props(styles.visuallyHidden)}>
          {statusText ?? "Searching…"}
        </p>
      ) : null}
      {hasColdLoadingState ? (
        <p
          aria-live="polite"
          {...stylex.props(foundationStyles.metadata, styles.searchingText)}
        >
          {statusText ?? "Searching…"}
        </p>
      ) : emptyText && variant === "default" ? (
        <p {...stylex.props(styles.stateText)}>{emptyText}</p>
      ) : null}
      {emptyText && variant === "database" ? (
        <div {...stylex.props(styles.databaseEmptyState)}>
          <SectionHeading>Nothing matches “{query}”</SectionHeading>
          <p {...stylex.props(styles.databaseEmptyDescription)}>
            Check the spelling, or record the bottle if the database is missing
            it.
          </p>
          {visibleContribution ? (
            <ButtonLink
              href={visibleContribution.href}
              size="sm"
              variant="accent"
            >
              Record this bottle
            </ButtonLink>
          ) : null}
        </div>
      ) : null}
      <div>
        {hasResults
          ? groups.map((group) =>
              group.items.length ? (
                <SearchResultsGroup
                  activeId={activeId}
                  group={group}
                  key={group.id}
                  onItemSelect={onItemSelect}
                  optionIdPrefix={optionIdPrefix}
                  query={query}
                  variant={variant}
                />
              ) : null,
            )
          : null}
      </div>
      {status === "error" ? (
        <div role="alert" {...stylex.props(styles.error)}>
          <span>
            {statusText ??
              "Search is temporarily unavailable. Existing navigation still works."}
          </span>
          {onRetry ? (
            <Button onClick={onRetry} size="sm" variant="tonal">
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}
      {visibleContribution && variant === "default" ? (
        <>
          <div aria-hidden="true" {...stylex.props(styles.contributionRule)} />
          <AppLink
            href={visibleContribution.href}
            {...stylex.props(styles.contribution)}
          >
            <span {...stylex.props(styles.contributionDescription)}>
              {visibleContribution.description}
            </span>
            <strong {...stylex.props(styles.contributionAction)}>
              {visibleContribution.label} →
            </strong>
          </AppLink>
        </>
      ) : null}
    </div>
  );

  return embedded ? (
    <div aria-label={label} role="region">
      {content}
    </div>
  ) : (
    <FloatingPanel aria-label={label} role="region">
      {content}
    </FloatingPanel>
  );
}

function SearchResultsGroup({
  activeId,
  group,
  onItemSelect,
  optionIdPrefix,
  query,
  variant,
}: {
  activeId?: string;
  group: SearchResultGroup;
  onItemSelect?: (item: SearchResultItem) => void;
  optionIdPrefix?: string;
  query: string;
  variant: "database" | "default";
}) {
  const remaining =
    group.total === undefined
      ? undefined
      : Math.max(group.total - group.items.length, 0);

  return (
    <section
      aria-labelledby={`${optionIdPrefix ?? "search"}-group-${group.id}`}
    >
      <div
        {...stylex.props(
          styles.groupHeading,
          variant === "database" && styles.databaseGroupHeading,
        )}
      >
        <div
          {...stylex.props(
            styles.groupName,
            variant === "database" && styles.databaseGroupName,
          )}
        >
          <SectionHeading
            id={`${optionIdPrefix ?? "search"}-group-${group.id}`}
          >
            {group.label}
          </SectionHeading>
        </div>
        {group.total !== undefined ? (
          <span
            {...stylex.props(
              foundationStyles.metadata,
              styles.groupCount,
              variant === "database" && styles.databaseGroupCount,
            )}
          >
            {group.total.toLocaleString("en-US")}
          </span>
        ) : null}
        {variant === "database" && group.moreHref ? (
          <AppLink href={group.moreHref} {...stylex.props(styles.databaseMore)}>
            See all {group.total?.toLocaleString("en-US")}
          </AppLink>
        ) : null}
      </div>
      <ul {...stylex.props(styles.list)}>
        {group.items.map((item) => (
          <li key={item.id} {...stylex.props(styles.listItem)}>
            {item.visual?.kind === "bottle" ? (
              <div
                id={
                  optionIdPrefix
                    ? `${optionIdPrefix}-${encodeURIComponent(item.id)}`
                    : undefined
                }
                {...stylex.props(
                  styles.result,
                  variant === "database" && styles.databaseResult,
                  item.id === activeId && styles.activeResult,
                )}
              >
                <BottleIdentityRow
                  {...item.bottle}
                  align="start"
                  href={item.href}
                  imageUrl={item.visual.imageUrl}
                  metadata={
                    item.bottle?.metadata ??
                    (item.metadata ? item.metadata.split(" · ") : [])
                  }
                  name={item.title}
                  query={query}
                  onClick={(event) => {
                    if (onItemSelect) {
                      event.preventDefault();
                      onItemSelect(item);
                    }
                  }}
                  end={
                    item.ratings ? (
                      <ResultRatings ratings={item.ratings} />
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <AppLink
                href={item.href}
                id={
                  optionIdPrefix
                    ? `${optionIdPrefix}-${encodeURIComponent(item.id)}`
                    : undefined
                }
                onClick={(event) => {
                  if (onItemSelect) {
                    event.preventDefault();
                    onItemSelect(item);
                  }
                }}
                {...stylex.props(
                  styles.result,
                  variant === "database" && styles.databaseResult,
                  item.id === activeId && styles.activeResult,
                )}
              >
                {item.visual ? <ResultVisual visual={item.visual} /> : null}
                <span {...stylex.props(styles.copy)}>
                  <strong
                    title={item.title}
                    {...stylex.props(foundationStyles.rowTitle, styles.title)}
                  >
                    <MatchedText query={query} text={item.title} />
                    {item.isFollowing ? (
                      <MemberStatus kind="following" />
                    ) : null}
                  </strong>
                  {item.metadata ? (
                    <span
                      title={item.metadata}
                      {...stylex.props(
                        foundationStyles.metadata,
                        styles.metadata,
                      )}
                    >
                      {item.metadata}
                    </span>
                  ) : null}
                  {item.ratings ? (
                    <span {...stylex.props(styles.compactRatings)}>
                      <ResultRatings ratings={item.ratings} />
                    </span>
                  ) : null}
                </span>
                {item.ratings ? (
                  <span {...stylex.props(styles.wideRatings)}>
                    <ResultRatings ratings={item.ratings} />
                  </span>
                ) : null}
              </AppLink>
            )}
          </li>
        ))}
      </ul>
      {group.moreHref && variant === "default" ? (
        <AppLink href={group.moreHref} {...stylex.props(styles.more)}>
          <span>
            {remaining === undefined || remaining === 0
              ? "More results"
              : `${remaining.toLocaleString("en-US")} more ${group.label.toLowerCase()}`}
          </span>
          <strong>{group.moreLabel ?? "See all"} →</strong>
        </AppLink>
      ) : null}
    </section>
  );
}

function ResultVisual({
  visual,
}: {
  visual: NonNullable<SearchResultItem["visual"]>;
}) {
  if (visual.kind === "bottle") {
    return <BottleVisual imageUrl={visual.imageUrl} label={visual.label} />;
  }
  if (visual.kind === "avatar") {
    return (
      <Avatar imageUrl={visual.imageUrl} initials={visual.fallback} size="sm" />
    );
  }
  return (
    <span aria-label={visual.label} role="img" {...stylex.props(styles.visual)}>
      <span aria-hidden="true">{visual.fallback}</span>
    </span>
  );
}

function ResultRatings({ ratings }: { ratings: SearchResultRatings }) {
  return ratings.score || ratings.bands ? (
    <BottleRatings
      counts={ratings.bands}
      median={ratings.score?.value}
      scoreCount={ratings.score?.count}
    />
  ) : null;
}

const styles = stylex.create({
  panel: {
    boxSizing: "border-box",
    width: "100%",
    maxHeight: "min(560px, calc(100vh - 96px))",
    overflow: "hidden",
    overflowY: "auto",
  },
  documentPanel: {
    maxHeight: "none",
    overflow: "visible",
  },
  searchingText: {
    margin: 0,
    paddingTop: "14px",
    paddingRight: "14px",
    paddingBottom: space.x4,
    paddingLeft: "14px",
    color: colors.inkMuted,
  },
  stateText: {
    boxSizing: "border-box",
    display: "flex",
    minHeight: "64px",
    alignItems: "center",
    margin: 0,
    paddingTop: space.x4,
    paddingRight: "14px",
    paddingBottom: space.x4,
    paddingLeft: "14px",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.55,
  },
  databaseEmptyState: {
    paddingTop: space.x6,
    paddingBottom: space.x2,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  databaseEmptyDescription: {
    maxWidth: "560px",
    marginTop: space.x2,
    marginRight: 0,
    marginBottom: space.x4,
    marginLeft: 0,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.5,
  },
  groupHeading: {
    display: "flex",
    alignItems: "baseline",
    gap: space.x3,
    paddingTop: space.x3,
    paddingRight: "14px",
    paddingBottom: space.x1,
    paddingLeft: "14px",
  },
  databaseGroupHeading: {
    gap: space.x2,
    paddingTop: space.x6,
    paddingRight: 0,
    paddingBottom: space.x2,
    paddingLeft: 0,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  groupName: { minWidth: 0, flex: 1 },
  databaseGroupName: { flex: 0 },
  groupCount: {
    color: colors.inkMuted,
    fontVariantNumeric: "tabular-nums",
  },
  databaseGroupCount: {
    flex: 0,
  },
  databaseMore: {
    marginLeft: "auto",
    outline: "none",
    color: colors.accentDeep,
    fontFamily: fonts.reading,
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1.3,
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  list: {
    margin: 0,
    paddingRight: "14px",
    paddingLeft: "14px",
    listStyle: "none",
  },
  listItem: {
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    ":last-child": {
      borderBottomWidth: 0,
    },
  },
  result: {
    boxSizing: "border-box",
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: space.x3,
    marginRight: "-14px",
    marginLeft: "-14px",
    paddingTop: "10px",
    paddingRight: "14px",
    paddingBottom: "10px",
    paddingLeft: "14px",
    outline: "none",
    color: colors.ink,
    textDecoration: "none",
    backgroundColor: {
      default: "transparent",
      ":hover": colors.surface,
      ":active": colors.inset,
      ":focus-visible": colors.surface,
    },
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  databaseResult: {
    marginRight: 0,
    marginLeft: 0,
    paddingRight: 0,
    paddingLeft: 0,
  },
  activeResult: {
    backgroundColor: colors.inset,
    boxShadow: effects.focusRing,
  },
  visual: {
    display: "inline-flex",
    width: "28px",
    height: "28px",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.inset,
    color: colors.inkMuted,
    fontFamily: fonts.display,
    fontSize: "11px",
    fontWeight: 700,
  },
  copy: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    alignItems: "flex-start",
  },
  title: {
    maxWidth: "100%",
    overflow: "hidden",
    color: "inherit",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  metadata: {
    maxWidth: "100%",
    overflow: "hidden",
    marginTop: space.x1,
    color: colors.inkMuted,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  wideRatings: {
    display: "flex",
    minWidth: "152px",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: space.x3,
    [COMPACT]: {
      display: "none",
    },
  },
  compactRatings: {
    display: "none",
    alignItems: "center",
    gap: space.x3,
    marginTop: space.x2,
    [COMPACT]: {
      display: "flex",
    },
  },
  more: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x3,
    marginRight: "14px",
    marginLeft: "14px",
    paddingTop: "10px",
    paddingBottom: "10px",
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    outline: "none",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.35,
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  contribution: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x3,
    paddingTop: space.x3,
    paddingRight: "14px",
    paddingBottom: space.x3,
    paddingLeft: "14px",
    outline: "none",
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
    [COMPACT]: {
      alignItems: "flex-start",
      flexDirection: "column",
      gap: space.x2,
    },
  },
  contributionRule: {
    height: "1px",
    marginTop: space.x2,
    marginRight: "14px",
    marginLeft: "14px",
    backgroundColor: colors.hairline,
  },
  contributionDescription: {
    minWidth: 0,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.4,
  },
  contributionAction: {
    flexShrink: 0,
    color: colors.accentDeep,
    fontFamily: fonts.display,
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    lineHeight: 1.2,
  },
  error: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x3,
    marginTop: space.x2,
    paddingTop: space.x3,
    paddingRight: "14px",
    paddingBottom: space.x3,
    paddingLeft: "14px",
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.4,
    [COMPACT]: {
      alignItems: "flex-start",
      flexDirection: "column",
    },
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
