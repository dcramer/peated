"use client";

import * as stylex from "@stylexjs/stylex";
import { Check, ChevronDown, X } from "lucide-react";
import type { InputHTMLAttributes, Ref } from "react";
import { useEffect, useId, useRef, useState } from "react";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../styles/tokens.stylex";
import { Chip } from "./chip.stylex";

const COMPACT = "@media (max-width: 559px)";

export type ScopedSearchOption = {
  /** Optional size of the searchable set. */
  count?: number;
  /** Text shown in the scope control. */
  label: string;
  /** Stable value passed to `onScopeChange`. */
  value: string;
};

export type ScopedSearchProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "disabled" | "style" | "type"
> & {
  defaultScopeMenuOpen?: boolean;
  disabled?: boolean;
  /** Removes the inset field treatment when the control heads an open typeahead. */
  expanded?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  /** Clears the controlled query. */
  onClear?: () => void;
  /** Receives the selected option value. */
  onScopeChange: (scope: string) => void;
  /** Value of the active scope option. */
  scope: string;
  /** Accessible name for the native scope selector. */
  scopeLabel?: string;
  /** Search scopes shown in selection order. */
  scopes: readonly ScopedSearchOption[];
};

/** Combines an explicit search scope and query input in one control. */
export function ScopedSearch({
  defaultScopeMenuOpen = false,
  disabled = false,
  expanded = false,
  inputRef,
  onClear,
  onScopeChange,
  scope,
  scopeLabel = "Search scope",
  scopes,
  ...inputProps
}: ScopedSearchProps) {
  const hasAppliedScope = scope !== scopes[0]?.value;
  const hasScopeChoices = scopes.length > 1;
  const hasQuery = String(inputProps.value ?? "").length > 0;
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scopeMenuOpen, setScopeMenuOpen] = useState(defaultScopeMenuOpen);
  const selectedScope =
    scopes.find((option) => option.value === scope) ?? scopes[0];

  useEffect(() => {
    if (!scopeMenuOpen) return;

    function closeOnOutsidePress(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setScopeMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [scopeMenuOpen]);

  return (
    <div
      ref={containerRef}
      {...stylex.props(styles.container, disabled && styles.disabled)}
    >
      <div
        {...stylex.props(
          styles.root,
          expanded && styles.expandedRoot,
          scopeMenuOpen && styles.scopeMenuRoot,
        )}
      >
        {hasScopeChoices ? (
          <span {...stylex.props(styles.scopePosition)}>
            <button
              aria-controls={scopeMenuOpen ? menuId : undefined}
              aria-expanded={scopeMenuOpen}
              aria-haspopup="listbox"
              aria-label={scopeLabel}
              disabled={disabled}
              onClick={() => setScopeMenuOpen((open) => !open)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setScopeMenuOpen(false);
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setScopeMenuOpen(true);
                }
              }}
              type="button"
              {...stylex.props(
                styles.scope,
                scopeMenuOpen && styles.openScope,
                hasAppliedScope && styles.appliedScope,
              )}
            >
              {selectedScope?.label ?? "Search"}
            </button>
            <ChevronDown
              aria-hidden="true"
              size={12}
              strokeWidth={1.75}
              {...stylex.props(
                styles.scopeIcon,
                scopeMenuOpen && styles.openScopeIcon,
                hasAppliedScope && styles.appliedScopeIcon,
              )}
            />
            {scopeMenuOpen ? (
              <div
                id={menuId}
                role="listbox"
                {...stylex.props(styles.scopeMenu)}
              >
                <div
                  aria-hidden="true"
                  {...stylex.props(styles.scopeMenuHeader)}
                />
                <div {...stylex.props(styles.scopeMenuOptions)}>
                  {scopes.map((option) => {
                    const selected = option.value === scope;
                    return (
                      <button
                        aria-selected={selected}
                        key={option.value}
                        onClick={() => {
                          onScopeChange(option.value);
                          setScopeMenuOpen(false);
                        }}
                        role="option"
                        type="button"
                        {...stylex.props(styles.scopeMenuOption)}
                      >
                        <span>{option.label}</span>
                        {option.count !== undefined ? (
                          <span {...stylex.props(styles.scopeMenuCount)}>
                            {option.count.toLocaleString("en-US")}
                          </span>
                        ) : null}
                        {selected ? (
                          <Check
                            aria-hidden="true"
                            size={13}
                            strokeWidth={2}
                            {...stylex.props(styles.scopeMenuCheck)}
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </span>
        ) : null}
        <input
          aria-label={inputProps["aria-label"] ?? "Search"}
          disabled={disabled}
          ref={inputRef}
          type="search"
          {...inputProps}
          onPointerDown={(event) => {
            inputProps.onPointerDown?.(event);
            setScopeMenuOpen(false);
          }}
          {...stylex.props(styles.input)}
        />
        {hasQuery && onClear ? (
          <button
            aria-label="Clear search"
            disabled={disabled}
            onClick={onClear}
            type="button"
            {...stylex.props(styles.clear)}
          >
            <X aria-hidden="true" size={14} strokeWidth={1.75} />
          </button>
        ) : null}
      </div>
      {hasScopeChoices ? (
        <div
          aria-label={scopeLabel}
          role="group"
          {...stylex.props(styles.compactScopes)}
        >
          {scopes.map((option) => {
            const selected = option.value === scope;
            return (
              <Chip
                aria-pressed={selected}
                disabled={disabled}
                key={option.value}
                onClick={() => onScopeChange(option.value)}
                variant={selected ? "solid" : "neutral"}
              >
                {option.label}
              </Chip>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

const styles = stylex.create({
  container: {
    position: "relative",
    width: "100%",
  },
  root: {
    boxSizing: "border-box",
    position: "relative",
    display: "flex",
    width: "100%",
    height: controlMetrics.controlHeight,
    alignItems: "center",
    columnGap: space.x3,
    paddingRight: space.x2,
    paddingLeft: space.x2,
    borderRadius: controlMetrics.radius,
    outlineWidth: {
      default: 0,
      ":focus-within": "2px",
    },
    outlineStyle: "solid",
    outlineColor: colors.accent,
    outlineOffset: "-4px",
    backgroundColor: colors.inset,
  },
  expandedRoot: {
    borderTopLeftRadius: controlMetrics.radius,
    borderTopRightRadius: controlMetrics.radius,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: 0,
    outlineWidth: "2px",
    backgroundColor: colors.ground,
  },
  scopeMenuRoot: {
    outlineWidth: 0,
  },
  scopePosition: {
    position: "relative",
    display: "inline-flex",
    minWidth: 0,
    flexShrink: 0,
    alignItems: "center",
    [COMPACT]: {
      display: "none",
    },
  },
  compactScopes: {
    display: "none",
    [COMPACT]: {
      display: "flex",
      overflowX: "auto",
      gap: space.x2,
      paddingTop: space.x2,
      paddingRight: space.x2,
      paddingBottom: space.x2,
      paddingLeft: space.x2,
      scrollbarWidth: "none",
    },
    "::-webkit-scrollbar": {
      display: "none",
    },
  },
  scope: {
    display: "block",
    height: "24px",
    maxWidth: "144px",
    overflow: "hidden",
    paddingRight: "23px",
    paddingLeft: "7px",
    borderWidth: 0,
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    backgroundColor: colors.accentTint,
    color: colors.accentDeep,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontWeight: 500,
    lineHeight: 1,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    cursor: "pointer",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  scopeIcon: {
    position: "absolute",
    right: "6px",
    color: colors.accentDeep,
    pointerEvents: "none",
  },
  openScope: {
    position: "relative",
    zIndex: 21,
  },
  openScopeIcon: {
    zIndex: 21,
  },
  appliedScope: {
    backgroundColor: colors.accent,
    color: colors.ground,
  },
  appliedScopeIcon: {
    color: colors.ground,
  },
  scopeMenu: {
    position: "absolute",
    zIndex: 20,
    top: "-8px",
    left: "-8px",
    width: "232px",
    overflow: "hidden",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.ground,
    color: colors.ink,
    boxShadow: effects.overlayShadow,
  },
  scopeMenuHeader: {
    boxSizing: "border-box",
    height: controlMetrics.controlHeight,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  scopeMenuOptions: {
    paddingTop: space.x1,
    paddingRight: space.x3,
    paddingBottom: space.x1,
    paddingLeft: "21px",
  },
  scopeMenuOption: {
    display: "flex",
    width: "100%",
    minHeight: controlMetrics.controlHeightSmall,
    alignItems: "center",
    gap: space.x2,
    paddingRight: 0,
    paddingLeft: 0,
    borderWidth: 0,
    outline: "none",
    backgroundColor: "transparent",
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.2,
    textAlign: "left",
    cursor: "pointer",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  scopeMenuCount: {
    marginLeft: "auto",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 400,
  },
  scopeMenuCheck: {
    flexShrink: 0,
    color: colors.accent,
  },
  input: {
    appearance: "none",
    minWidth: 0,
    height: "100%",
    flex: 1,
    padding: 0,
    borderWidth: 0,
    outline: "none",
    backgroundColor: "transparent",
    boxShadow: {
      default: "none",
      ":focus": "none",
      ":focus-visible": "none",
    },
    color: colors.ink,
    fontFamily: fonts.data,
    fontSize: "13px",
    lineHeight: 1.4,
    "::placeholder": {
      color: colors.inkMuted,
      opacity: 1,
    },
    "::-webkit-search-cancel-button": {
      display: "none",
    },
  },
  clear: {
    display: "inline-flex",
    width: controlMetrics.controlHeightSmall,
    height: controlMetrics.controlHeightSmall,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    borderWidth: 0,
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    backgroundColor: "transparent",
    color: colors.inkMuted,
    cursor: "pointer",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  disabled: {
    cursor: "not-allowed",
    opacity: 0.45,
  },
});
