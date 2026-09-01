"use client";

import * as stylex from "@stylexjs/stylex";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
  zIndices,
} from "../styles/tokens.stylex";
import { Button } from "./button.stylex";
import { FacetGroup, FilterPanel } from "./filterPanel.stylex";
import { ScopedSearch, type ScopedSearchOption } from "./scopedSearch.stylex";
import {
  SearchResults,
  type SearchResultGroup,
  type SearchResultItem,
  type SearchResultsProps,
} from "./searchResults.stylex";

const COMPACT = "@media (max-width: 559px)";

export type SearchBoxProps = Pick<
  SearchResultsProps,
  "contribution" | "emptyText" | "onRetry" | "status" | "statusText"
> & {
  autoFocus?: boolean;
  browseHeader?: ReactNode;
  defaultOpen?: boolean;
  disabled?: boolean;
  fluid?: boolean;
  groups: readonly SearchResultGroup[];
  onClose?: () => void;
  onQueryChange: (query: string) => void;
  onResultSelect?: (item: SearchResultItem) => void;
  onScopeChange: (scope: string) => void;
  onSubmit?: (query: string) => void;
  placeholder?: string;
  placement?: "database" | "overlay" | "page";
  query: string;
  resultCount?: number;
  resultQuery?: string;
  scope: string;
  scopeFacets?: readonly ScopedSearchOption[];
  scopes: readonly ScopedSearchOption[];
  submitLabel?: string;
  typeaheadNavigation?: boolean;
};

/** Owns the keyboard and disclosure behavior for Peated's scoped search UI. */
export function SearchBox({
  autoFocus = false,
  browseHeader,
  contribution,
  defaultOpen = false,
  disabled = false,
  emptyText,
  fluid = false,
  groups,
  onClose,
  onQueryChange,
  onResultSelect,
  onRetry,
  onScopeChange,
  onSubmit,
  placeholder = "bottles, distillers, brands…",
  placement = "overlay",
  query,
  resultCount,
  resultQuery = query,
  scope,
  scopeFacets,
  scopes,
  status = "ready",
  statusText,
  submitLabel = "Search",
  typeaheadNavigation = true,
}: SearchBoxProps) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const [open, setOpen] = useState(defaultOpen);
  const items = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const activeId = typeaheadNavigation
    ? (items.find((item) => item.id === selectedId)?.id ??
      (query.trim() && resultQuery.trim() === query.trim()
        ? items[0]?.id
        : undefined))
    : undefined;
  const hasPanelContent =
    groups.length > 0 ||
    Boolean(emptyText) ||
    Boolean(contribution) ||
    status !== "ready";
  const expanded =
    (placement === "database" || placement === "page" || open) &&
    hasPanelContent;

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target =
        event.target instanceof HTMLElement ? event.target : undefined;
      if (
        target?.matches("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
      setOpen(true);
    }

    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const option = document.getElementById(
      `${panelId}-${encodeURIComponent(activeId)}`,
    );
    option?.scrollIntoView({ block: "nearest" });
  }, [activeId, panelId]);

  useEffect(() => {
    function closeOnOutsidePress(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        if (placement === "overlay") setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [placement]);

  function moveActive(offset: -1 | 1) {
    if (!items.length) return;
    const currentIndex = items.findIndex((item) => item.id === activeId);
    const nextIndex =
      currentIndex < 0
        ? offset > 0
          ? 0
          : items.length - 1
        : (currentIndex + offset + items.length) % items.length;
    setSelectedId(items[nextIndex]?.id);
    setOpen(true);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!typeaheadNavigation) {
      if (event.key === "Enter") {
        event.preventDefault();
        onSubmit?.(query);
      }
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const activeItem = items.find((item) => item.id === activeId);
      if (activeItem) {
        selectResult(activeItem);
      } else {
        onSubmit?.(query);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      if (query) {
        onQueryChange("");
        setSelectedId(undefined);
      } else {
        setOpen(false);
        onClose?.();
      }
    }
  }

  function selectResult(item: SearchResultItem) {
    setOpen(false);
    if (onResultSelect) {
      onResultSelect(item);
      return;
    }
    window.location.assign(item.href);
  }

  const searchControl = (
    <ScopedSearch
      aria-activedescendant={
        typeaheadNavigation && activeId
          ? `${panelId}-${encodeURIComponent(activeId)}`
          : undefined
      }
      aria-autocomplete={typeaheadNavigation ? "list" : undefined}
      aria-controls={expanded ? panelId : undefined}
      autoFocus={autoFocus}
      disabled={disabled}
      expanded={placement !== "database" && expanded}
      inputRef={inputRef}
      onChange={(event) => {
        onQueryChange(event.currentTarget.value);
        setSelectedId(undefined);
        setOpen(true);
      }}
      onClear={() => {
        onQueryChange("");
        setSelectedId(undefined);
        inputRef.current?.focus();
      }}
      onFocus={() => setOpen(true)}
      onKeyDown={handleKeyDown}
      onScopeChange={(nextScope) => {
        onScopeChange(nextScope);
        setSelectedId(undefined);
        inputRef.current?.focus();
        setOpen(true);
      }}
      placeholder={placeholder}
      scope={scope}
      scopes={
        placement === "database"
          ? scopes.filter((option) => option.value === scope)
          : scopes
      }
      value={query}
    />
  );

  if (placement === "database") {
    const facetOptions = scopeFacets?.filter(
      (option) => option.value !== "all",
    );
    const facetTotal = scopeFacets?.find(
      (option) => option.value === "all",
    )?.count;
    const facets = facetOptions?.length ? (
      <FacetGroup
        label="Type"
        onChange={(nextScope) => onScopeChange(nextScope || "all")}
        options={facetOptions}
        selected={scope === "all" ? undefined : scope}
        total={facetTotal}
      />
    ) : null;
    const searchRow = (
      <div role="search" {...stylex.props(styles.databaseSearchRow)}>
        <div {...stylex.props(styles.databaseSearchControl)}>
          {searchControl}
        </div>
        <Button
          disabled={!query.trim()}
          onClick={() => onSubmit?.(query)}
          size="md"
          variant="accent"
        >
          {submitLabel}
        </Button>
      </div>
    );

    return (
      <div ref={rootRef} {...stylex.props(styles.databaseRoot)}>
        {!query.trim() ? (
          <>
            {browseHeader}
            <div {...stylex.props(styles.databaseBrowseSearch)}>
              {searchRow}
              {expanded ? (
                <SearchResults
                  activeId={typeaheadNavigation ? activeId : undefined}
                  embedded
                  groups={groups}
                  label="Recent searches"
                  onItemSelect={typeaheadNavigation ? selectResult : undefined}
                  optionIdPrefix={typeaheadNavigation ? panelId : undefined}
                  panelId={panelId}
                  query=""
                  scroll={false}
                  status={status}
                  variant="database"
                />
              ) : null}
            </div>
          </>
        ) : (
          <div {...stylex.props(styles.databaseLayout)}>
            <div {...stylex.props(styles.databaseMain)}>
              {searchRow}
              <div aria-hidden="true" {...stylex.props(styles.dividerTrack)}>
                <span
                  {...stylex.props(
                    styles.divider,
                    status === "searching" && styles.searchingDivider,
                  )}
                />
              </div>
              {facets ? (
                <div {...stylex.props(styles.databaseMobileFacets)}>
                  <FilterPanel ariaLabel="Search filters">
                    <div {...stylex.props(styles.databaseMobileFacetContent)}>
                      {facets}
                    </div>
                  </FilterPanel>
                </div>
              ) : null}
              {status === "ready" && resultCount !== undefined ? (
                <p aria-live="polite" {...stylex.props(styles.databaseCount)}>
                  {resultCount.toLocaleString("en-US")}{" "}
                  {resultCount === 1 ? "result" : "results"}
                </p>
              ) : null}
              {expanded ? (
                <SearchResults
                  activeId={typeaheadNavigation ? activeId : undefined}
                  contribution={contribution}
                  embedded
                  emptyText={emptyText}
                  groups={groups}
                  onItemSelect={typeaheadNavigation ? selectResult : undefined}
                  onRetry={onRetry}
                  optionIdPrefix={typeaheadNavigation ? panelId : undefined}
                  panelId={panelId}
                  query={resultQuery}
                  scroll={false}
                  status={status}
                  statusText={statusText}
                  variant="database"
                />
              ) : null}
            </div>
            {facets ? (
              <aside {...stylex.props(styles.databaseFacets)}>{facets}</aside>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      {...stylex.props(
        styles.root,
        fluid && styles.fluidRoot,
        placement === "page" && styles.pageRoot,
      )}
    >
      <div
        {...stylex.props(
          styles.surface,
          expanded && styles.expandedSurface,
          placement === "page" && styles.pageSurface,
        )}
      >
        {searchControl}
        {expanded ? (
          <div {...stylex.props(styles.results)}>
            <div aria-hidden="true" {...stylex.props(styles.dividerTrack)}>
              <span
                {...stylex.props(
                  styles.divider,
                  status === "searching" && styles.searchingDivider,
                )}
              />
            </div>
            <SearchResults
              activeId={typeaheadNavigation ? activeId : undefined}
              contribution={contribution}
              embedded
              emptyText={emptyText}
              groups={groups}
              label={query.trim() ? "Search results" : "Recent searches"}
              onItemSelect={typeaheadNavigation ? selectResult : undefined}
              onRetry={onRetry}
              optionIdPrefix={typeaheadNavigation ? panelId : undefined}
              panelId={panelId}
              query={resultQuery}
              scroll={placement === "overlay"}
              status={status}
              statusText={statusText}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

const searchSweep = stylex.keyframes({
  from: { transform: "translateX(-100%)" },
  to: { transform: "translateX(300%)" },
});

const styles = stylex.create({
  databaseRoot: {
    width: "100%",
  },
  databaseBrowseSearch: {
    width: "100%",
    maxWidth: "660px",
    marginRight: "auto",
    marginLeft: "auto",
  },
  databaseLayout: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: "minmax(0, 1fr) 300px",
    gap: space.x12,
    alignItems: "start",
    "@media (max-width: 759px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  databaseMain: {
    minWidth: 0,
  },
  databaseSearchRow: {
    display: "flex",
    minWidth: 0,
    alignItems: "flex-start",
    gap: space.x2,
  },
  databaseSearchControl: {
    minWidth: 0,
    flex: 1,
  },
  databaseCount: {
    marginTop: space.x4,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    paddingBottom: space.x3,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "17px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  databaseFacets: {
    minWidth: 0,
    paddingTop: "2px",
    "@media (max-width: 759px)": {
      display: "none",
    },
  },
  databaseMobileFacets: {
    display: "none",
    marginTop: space.x4,
    "@media (max-width: 759px)": {
      display: "block",
    },
  },
  databaseMobileFacetContent: {
    minWidth: 0,
    gridColumn: "1 / -1",
  },
  root: {
    position: "relative",
    width: "100%",
    height: controlMetrics.controlHeight,
    maxWidth: "620px",
    [COMPACT]: {
      height: "auto",
      minHeight: controlMetrics.controlHeight,
    },
  },
  pageRoot: {
    height: "auto",
    maxWidth: "880px",
  },
  fluidRoot: {
    maxWidth: "none",
  },
  surface: {
    width: "100%",
  },
  expandedSurface: {
    position: "absolute",
    zIndex: zIndices.menu,
    top: 0,
    right: 0,
    left: 0,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.ground,
    boxShadow: effects.overlayShadow,
  },
  pageSurface: {
    position: "relative",
    zIndex: zIndices.base,
    top: "auto",
    right: "auto",
    left: "auto",
    boxShadow: "none",
  },
  results: {
    width: "100%",
  },
  divider: {
    display: "block",
    width: "100%",
    height: "1px",
    backgroundColor: colors.hairline,
  },
  dividerTrack: {
    height: "2px",
    overflow: "hidden",
    marginRight: "14px",
    marginLeft: "14px",
  },
  searchingDivider: {
    display: "block",
    width: "33%",
    height: "2px",
    backgroundColor: colors.accent,
    animationName: {
      default: searchSweep,
      "@media (prefers-reduced-motion: reduce)": "none",
    },
    animationDuration: "1.15s",
    animationTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
    animationIterationCount: "infinite",
  },
});
