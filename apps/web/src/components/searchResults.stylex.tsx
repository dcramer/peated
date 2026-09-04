import * as stylex from "@stylexjs/stylex";
import {
  EntityIdentityRow,
  type EntityIdentity,
} from "./entityIdentityRow.stylex";
import {
  LocationIdentityRow,
  type LocationIdentityRowProps,
} from "./locationIdentityRow.stylex";
import { SectionHeading } from "./sectionHeading.stylex";
import {
  SeriesIdentityRow,
  type SeriesIdentityRowProps,
} from "./seriesIdentityRow.stylex";
import type { TextIdentityRowProps } from "./textIdentityRow.stylex";

import { foundationStyles } from "../styles/foundations.stylex";
import { colors, effects, space } from "../styles/tokens.stylex";
import { AppLink } from "./appLink";
import { Avatar } from "./avatar.stylex";
import {
  BottleIdentityRow,
  type BottleIdentityRowProps,
} from "./bottleIdentityRow.stylex";
import { Button, ButtonLink } from "./button.stylex";
import { FloatingPanel } from "./feedback.stylex";
import { MatchedText } from "./matchedText.stylex";
import { BottleRatings, type BottleRatingsProps } from "./scoring.stylex";

const COMPACT = "@media (max-width: 559px)";

export type SearchResultRatings = BottleRatingsProps;

export type SearchResultItem = {
  href: string;
  id: string;
  entity?: Pick<EntityIdentity, "kind" | "location" | "isFollowing">;
  series?: Pick<SeriesIdentityRowProps, "brand">;
  location?: Pick<LocationIdentityRowProps, "country">;
  ratings?: SearchResultRatings;
  title: string;
} & (
  | {
      bottle: Pick<BottleIdentityRowProps, "provenance" | "metadata">;
      metadata?: never;
      visual: { kind: "bottle"; imageUrl?: string | null; label: string };
    }
  | {
      bottle?: never;
      metadata?: string;
      visual?: {
        kind: "avatar";
        fallback: string;
        imageUrl?: string | null;
        label: string;
      };
    }
);

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
 * Default uses compact typeahead rows and group labels; database uses page headings.
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
        <p {...stylex.props(foundationStyles.body, styles.stateText)}>
          {emptyText}
        </p>
      ) : null}
      {emptyText && variant === "database" ? (
        <div {...stylex.props(styles.databaseEmptyState)}>
          <SectionHeading>Nothing matches “{query}”</SectionHeading>
          <p
            {...stylex.props(
              foundationStyles.body,
              styles.databaseEmptyDescription,
            )}
          >
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
        <div
          role="alert"
          {...stylex.props(foundationStyles.metadata, styles.error)}
        >
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
            <span
              {...stylex.props(
                foundationStyles.metadata,
                styles.contributionDescription,
              )}
            >
              {visibleContribution.description}
            </span>
            <strong
              {...stylex.props(
                foundationStyles.interactiveSmall,
                styles.contributionAction,
              )}
            >
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
  function identityProps(
    item: SearchResultItem,
  ): Pick<
    TextIdentityRowProps,
    "href" | "name" | "query" | "variant" | "onClick"
  > {
    return {
      href: item.href,
      name: item.title,
      query,
      variant: variant === "database" ? "standard" : "search",
      onClick: (event) => {
        if (onItemSelect) {
          event.preventDefault();
          onItemSelect(item);
        }
      },
    };
  }

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
        <div {...stylex.props(styles.groupName)}>
          {variant === "database" ? (
            <SectionHeading
              id={`${optionIdPrefix ?? "search"}-group-${group.id}`}
            >
              {group.label}
            </SectionHeading>
          ) : (
            <span
              id={`${optionIdPrefix ?? "search"}-group-${group.id}`}
              {...stylex.props(foundationStyles.fieldLabel, styles.groupLabel)}
            >
              {group.label}
            </span>
          )}
        </div>
        {group.total !== undefined ? (
          <span {...stylex.props(foundationStyles.metadata, styles.groupCount)}>
            {group.total.toLocaleString("en-US")}
          </span>
        ) : null}
        {group.moreHref ? (
          <AppLink
            aria-label={`See all ${group.total === undefined ? "" : `${group.total.toLocaleString("en-US")} `}${group.label.toLowerCase()}`}
            href={group.moreHref}
            {...stylex.props(
              foundationStyles.interactiveSmall,
              styles.groupMore,
            )}
          >
            {group.moreLabel ?? "See all"} →
          </AppLink>
        ) : null}
      </div>
      <ul {...stylex.props(styles.list)}>
        {group.items.map((item) => (
          <li key={item.id} {...stylex.props(styles.listItem)}>
            {item.bottle ? (
              <div
                id={
                  optionIdPrefix
                    ? `${optionIdPrefix}-${encodeURIComponent(item.id)}`
                    : undefined
                }
                {...stylex.props(
                  styles.result,
                  styles.identityResult,
                  variant === "database" && styles.databaseResult,
                  item.id === activeId && styles.activeResult,
                )}
              >
                <BottleIdentityRow
                  {...item.bottle}
                  href={item.href}
                  imageUrl={item.visual.imageUrl}
                  name={item.title}
                  query={query}
                  variant={variant === "database" ? "standard" : "search"}
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
            ) : item.entity || item.series || item.location ? (
              <div
                id={
                  optionIdPrefix
                    ? `${optionIdPrefix}-${encodeURIComponent(item.id)}`
                    : undefined
                }
                {...stylex.props(
                  styles.result,
                  styles.identityResult,
                  variant === "database" && styles.databaseResult,
                  item.id === activeId && styles.activeResult,
                )}
              >
                {item.entity ? (
                  <EntityIdentityRow
                    {...item.entity}
                    {...identityProps(item)}
                  />
                ) : item.series ? (
                  <SeriesIdentityRow
                    {...item.series}
                    {...identityProps(item)}
                  />
                ) : (
                  <LocationIdentityRow
                    {...item.location}
                    {...identityProps(item)}
                  />
                )}
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
                    {...stylex.props(
                      variant === "database"
                        ? foundationStyles.rowTitle
                        : foundationStyles.compactRowTitle,
                      styles.title,
                    )}
                  >
                    <MatchedText query={query} text={item.title} />
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
    </section>
  );
}

function ResultVisual({
  visual,
}: {
  visual: Exclude<NonNullable<SearchResultItem["visual"]>, { kind: "bottle" }>;
}) {
  return (
    <Avatar imageUrl={visual.imageUrl} initials={visual.fallback} size="sm" />
  );
}

function ResultRatings({ ratings }: { ratings: SearchResultRatings }) {
  return <BottleRatings {...ratings} />;
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
    paddingTop: space.x3,
    paddingRight: space.x3,
    paddingBottom: space.x4,
    paddingLeft: space.x3,
    color: colors.inkMuted,
  },
  stateText: {
    boxSizing: "border-box",
    display: "flex",
    minHeight: "64px",
    alignItems: "center",
    margin: 0,
    paddingTop: space.x4,
    paddingRight: space.x3,
    paddingBottom: space.x4,
    paddingLeft: space.x3,
    color: colors.inkMuted,
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
  },
  groupHeading: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
    paddingTop: space.x3,
    paddingRight: space.x3,
    paddingBottom: space.x1,
    paddingLeft: space.x3,
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
  groupName: { minWidth: 0 },
  groupLabel: { color: colors.inkMuted },
  groupCount: {
    color: colors.inkMuted,
    fontVariantNumeric: "tabular-nums",
  },
  groupMore: {
    display: "inline-flex",
    minHeight: "24px",
    alignItems: "center",
    marginLeft: "auto",
    outline: "none",
    color: colors.accentDeep,
    fontWeight: 700,
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
      ":active": "underline",
      ":focus-visible": "underline",
    },
    [COMPACT]: { minHeight: "44px" },
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  list: {
    margin: 0,
    paddingRight: space.x3,
    paddingLeft: space.x3,
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
    minHeight: "44px",
    alignItems: "center",
    gap: space.x3,
    marginRight: "-12px",
    marginLeft: "-12px",
    paddingTop: space.x2,
    paddingRight: space.x3,
    paddingBottom: space.x2,
    paddingLeft: space.x3,
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
  identityResult: {
    paddingTop: 0,
    paddingBottom: 0,
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
  contribution: {
    boxSizing: "border-box",
    display: "flex",
    minHeight: "44px",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x3,
    paddingTop: space.x3,
    paddingRight: space.x3,
    paddingBottom: space.x3,
    paddingLeft: space.x3,
    outline: "none",
    textDecoration: "none",
    backgroundColor: {
      default: "transparent",
      ":hover": colors.surface,
      ":active": colors.inset,
    },
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
    marginRight: space.x3,
    marginLeft: space.x3,
    backgroundColor: colors.hairline,
  },
  contributionDescription: {
    minWidth: 0,
    color: colors.inkMuted,
  },
  contributionAction: {
    flexShrink: 0,
    color: colors.accentDeep,
    fontWeight: 700,
  },
  error: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x3,
    marginTop: space.x2,
    paddingTop: space.x3,
    paddingRight: space.x3,
    paddingBottom: space.x3,
    paddingLeft: space.x3,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    color: colors.inkMuted,
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
