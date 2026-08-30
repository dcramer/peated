import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../styles/tokens.stylex";
import { AppLink } from "./appLink";
import { Button, ButtonLink } from "./button.stylex";
import { FloatingPanel } from "./feedback.stylex";
import { MemberStatusMark } from "./memberStatusMark.stylex";
import { RatingMeasure, type BandCounts } from "./scoring.stylex";

const COMPACT = "@media (max-width: 559px)";

export type SearchResultMeasure = {
  score?: {
    count: number;
    value: number;
  };
  bands?: BandCounts;
};

export type SearchResultItem = {
  href: string;
  id: string;
  isFollowing?: boolean;
  measures?: SearchResultMeasure;
  metadata?: string;
  title: string;
  visual?: {
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

/** Presents supplied search results without owning search, ranking, or navigation. */
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
        <p aria-live="polite" {...stylex.props(styles.searchingText)}>
          {statusText ?? "Searching…"}
        </p>
      ) : emptyText && variant === "default" ? (
        <p {...stylex.props(styles.stateText)}>{emptyText}</p>
      ) : null}
      {emptyText && variant === "database" ? (
        <div {...stylex.props(styles.databaseEmptyState)}>
          <h2 {...stylex.props(styles.databaseEmptyHeading)}>
            Nothing matches “{query}”
          </h2>
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
        <h2
          id={`${optionIdPrefix ?? "search"}-group-${group.id}`}
          {...stylex.props(
            styles.groupName,
            variant === "database" && styles.databaseGroupName,
          )}
        >
          {group.label}
        </h2>
        {group.total !== undefined ? (
          <span
            {...stylex.props(
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
                <strong {...stylex.props(styles.title)}>
                  <MatchedText query={query} text={item.title} />
                  {item.isFollowing ? (
                    <MemberStatusMark kind="following" />
                  ) : null}
                </strong>
                {item.metadata ? (
                  <span {...stylex.props(styles.metadata)}>
                    {item.metadata}
                  </span>
                ) : null}
                {item.measures ? (
                  <span {...stylex.props(styles.compactMeasures)}>
                    <ResultMeasures measures={item.measures} />
                  </span>
                ) : null}
              </span>
              {item.measures ? (
                <span {...stylex.props(styles.wideMeasures)}>
                  <ResultMeasures measures={item.measures} />
                </span>
              ) : null}
            </AppLink>
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
  return (
    <span aria-label={visual.label} role="img" {...stylex.props(styles.visual)}>
      {visual.imageUrl ? (
        <img
          alt=""
          src={visual.imageUrl}
          {...stylex.props(styles.visualImage)}
        />
      ) : (
        <span aria-hidden="true">{visual.fallback}</span>
      )}
    </span>
  );
}

function ResultMeasures({ measures }: { measures: SearchResultMeasure }) {
  return measures.score || measures.bands ? (
    <RatingMeasure
      counts={measures.bands}
      median={measures.score?.value}
      scoreCount={measures.score?.count}
    />
  ) : null;
}

function MatchedText({ query, text }: { query: string; text: string }) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const start = normalizedQuery
    ? text.toLocaleLowerCase().indexOf(normalizedQuery)
    : -1;

  if (start < 0) return text;

  const end = start + normalizedQuery.length;
  return (
    <>
      {text.slice(0, start)}
      <mark {...stylex.props(styles.match)}>{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
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
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.4,
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
  databaseEmptyHeading: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "17px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
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
  groupName: {
    minWidth: 0,
    flex: 1,
    margin: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontWeight: 400,
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  databaseGroupName: {
    flex: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "14px",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    textTransform: "none",
    whiteSpace: "nowrap",
  },
  groupCount: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.3,
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
    backgroundColor: colors.surface,
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
  visualImage: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
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
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  match: {
    borderRadius: "1px",
    backgroundColor: colors.accentTint,
    color: "inherit",
  },
  metadata: {
    maxWidth: "100%",
    overflow: "hidden",
    marginTop: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.35,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  wideMeasures: {
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
  compactMeasures: {
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
