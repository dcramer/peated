"use client";

import * as stylex from "@stylexjs/stylex";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { colors, controlMetrics, effects } from "../../../styles/tokens.stylex";
import { ScopedSearch, type ScopedSearchOption } from "./scopedSearch.stylex";
import {
  SearchResultsPanel,
  type SearchResultGroup,
  type SearchResultItem,
  type SearchResultsPanelProps,
} from "./searchResults.stylex";

const COMPACT = "@media (max-width: 559px)";

export type SearchExperienceProps = Pick<
  SearchResultsPanelProps,
  "contribution" | "emptyText" | "onRetry" | "status" | "statusText"
> & {
  defaultOpen?: boolean;
  disabled?: boolean;
  groups: readonly SearchResultGroup[];
  onClose?: () => void;
  onQueryChange: (query: string) => void;
  onResultSelect?: (item: SearchResultItem) => void;
  onScopeChange: (scope: string) => void;
  onSubmit?: (query: string) => void;
  placeholder?: string;
  query: string;
  scope: string;
  scopes: readonly ScopedSearchOption[];
};

/** Owns the keyboard and disclosure behavior for Peated's scoped search UI. */
export function SearchExperience({
  contribution,
  defaultOpen = false,
  disabled = false,
  emptyText,
  groups,
  onClose,
  onQueryChange,
  onResultSelect,
  onRetry,
  onScopeChange,
  onSubmit,
  placeholder = "bottles, distillers, brands…",
  query,
  scope,
  scopes,
  status = "ready",
  statusText,
}: SearchExperienceProps) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeId, setActiveId] = useState<string>();
  const [open, setOpen] = useState(defaultOpen);
  const items = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const hasPanelContent =
    groups.length > 0 ||
    Boolean(emptyText) ||
    Boolean(contribution) ||
    status !== "ready";
  const expanded = open && hasPanelContent;

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
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, []);

  function moveActive(offset: -1 | 1) {
    if (!items.length) return;
    const currentIndex = items.findIndex((item) => item.id === activeId);
    const nextIndex =
      currentIndex < 0
        ? offset > 0
          ? 0
          : items.length - 1
        : (currentIndex + offset + items.length) % items.length;
    setActiveId(items[nextIndex]?.id);
    setOpen(true);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
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
        setActiveId(undefined);
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

  return (
    <div ref={rootRef} {...stylex.props(styles.root)}>
      <div
        {...stylex.props(styles.surface, expanded && styles.expandedSurface)}
      >
        <ScopedSearch
          aria-activedescendant={
            activeId ? `${panelId}-${encodeURIComponent(activeId)}` : undefined
          }
          aria-autocomplete="list"
          aria-controls={expanded ? panelId : undefined}
          disabled={disabled}
          expanded={expanded}
          inputRef={inputRef}
          onChange={(event) => {
            onQueryChange(event.currentTarget.value);
            setActiveId(items[0]?.id);
            setOpen(true);
          }}
          onClear={() => {
            onQueryChange("");
            setActiveId(undefined);
            inputRef.current?.focus();
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onScopeChange={(nextScope) => {
            onScopeChange(nextScope);
            setActiveId(undefined);
            inputRef.current?.focus();
            setOpen(true);
          }}
          placeholder={placeholder}
          scope={scope}
          scopes={scopes}
          value={query}
        />
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
            <SearchResultsPanel
              activeId={activeId}
              contribution={contribution}
              embedded
              emptyText={emptyText}
              groups={groups}
              onItemSelect={selectResult}
              onRetry={onRetry}
              optionIdPrefix={panelId}
              panelId={panelId}
              query={query}
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
  surface: {
    width: "100%",
  },
  expandedSurface: {
    position: "absolute",
    zIndex: 10,
    top: 0,
    right: 0,
    left: 0,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.ground,
    boxShadow: effects.overlayShadow,
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
