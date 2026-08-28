"use client";

import * as stylex from "@stylexjs/stylex";
import type { FocusEvent, KeyboardEvent } from "react";
import { useId, useMemo, useState } from "react";

import { foundationStyles } from "../../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../../styles/tokens.stylex";
import { FloatingPanel } from "./feedback.stylex";

export type EntityPickerKind =
  | "brand"
  | "bottler"
  | "distiller"
  | "entity"
  | "note";

export type EntityPickerOption = {
  detail: string;
  id: string;
  meta: string;
  name: string;
};

export type EntityPickerProps = {
  help?: string;
  kind: EntityPickerKind;
  label?: string;
  loading?: boolean;
  onChange: (value: EntityPickerOption | null) => void;
  onCreate?: (query: string) => void;
  onQueryChange?: (query: string) => void;
  options: readonly EntityPickerOption[];
  placeholder?: string;
  value: EntityPickerOption | null;
};

const kindCopy = {
  brand: { label: "Brand", plural: "brands", singular: "brand" },
  bottler: { label: "Bottler", plural: "bottlers", singular: "bottler" },
  distiller: {
    label: "Distiller",
    plural: "distillers",
    singular: "distiller",
  },
  entity: { label: "Entity", plural: "entities", singular: "entity" },
  note: { label: "Note", plural: "notes", singular: "note" },
} satisfies Record<
  EntityPickerKind,
  { label: string; plural: string; singular: string }
>;

export function EntityPicker({
  help,
  kind,
  label,
  loading = false,
  onChange,
  onCreate,
  onQueryChange,
  options,
  placeholder,
  value,
}: EntityPickerProps) {
  const generatedId = useId();
  const inputId = `${generatedId}-input`;
  const listboxId = `${generatedId}-listbox`;
  const helpId = `${generatedId}-help`;
  const copy = kindCopy[kind];
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const filteredOptions = useMemo(() => {
    const normalizedQuery = trimmedQuery.toLocaleLowerCase();
    if (!normalizedQuery) return options;

    return options.filter((option) =>
      option.name.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [options, trimmedQuery]);
  const activeOption = filteredOptions[activeIndex];

  function selectOption(option: EntityPickerOption) {
    onChange(option);
    setQuery("");
    setActiveIndex(-1);
    setIsOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      if (filteredOptions.length > 0) {
        setActiveIndex((current) =>
          current >= filteredOptions.length - 1 ? 0 : current + 1,
        );
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      if (filteredOptions.length > 0) {
        setActiveIndex((current) =>
          current <= 0 ? filteredOptions.length - 1 : current - 1,
        );
      }
      return;
    }

    if (event.key === "Enter" && isOpen && activeOption) {
      event.preventDefault();
      selectOption(activeOption);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setActiveIndex(-1);
      setIsOpen(false);
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setActiveIndex(-1);
      setIsOpen(false);
    }
  }

  function handleCreate() {
    if (!trimmedQuery || !onCreate) return;

    onCreate(trimmedQuery);
    setActiveIndex(-1);
    setIsOpen(false);
  }

  return (
    <div
      data-state={value ? "picked" : isOpen ? "open" : "idle"}
      onBlur={handleBlur}
      {...stylex.props(styles.picker)}
    >
      <label
        htmlFor={inputId}
        {...stylex.props(foundationStyles.fieldLabel, styles.label)}
      >
        {label ?? copy.label}
      </label>

      {value ? (
        <>
          <div {...stylex.props(styles.selectedControl)}>
            <span {...stylex.props(styles.selectedName)}>{value.name}</span>
            <span {...stylex.props(styles.idChip)}>{value.id}</span>
            <button
              aria-label={`Clear ${value.name}`}
              onClick={() => onChange(null)}
              type="button"
              {...stylex.props(styles.clearButton)}
            >
              ×
            </button>
          </div>
          <p
            {...stylex.props(foundationStyles.metadata, styles.selectedDetail)}
          >
            {value.detail}
          </p>
        </>
      ) : (
        <>
          <div {...stylex.props(styles.searchPosition)}>
            <div {...stylex.props(styles.searchControl)}>
              <input
                aria-activedescendant={
                  activeOption
                    ? `${listboxId}-option-${activeIndex}`
                    : undefined
                }
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-describedby={helpId}
                aria-expanded={isOpen}
                id={inputId}
                onChange={(event) => {
                  const nextQuery = event.currentTarget.value;
                  setQuery(nextQuery);
                  onQueryChange?.(nextQuery);
                  setActiveIndex(-1);
                  setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder ?? `Search ${copy.plural}`}
                role="combobox"
                type="text"
                value={query}
                {...stylex.props(styles.searchInput)}
              />
              <span
                aria-live="polite"
                {...stylex.props(foundationStyles.metadata, styles.matchCount)}
              >
                {filteredOptions.length}{" "}
                {filteredOptions.length === 1 ? "match" : "matches"}
              </span>
            </div>

            {isOpen ? (
              <FloatingPanel {...stylex.props(styles.overlay)}>
                <div
                  aria-label={`${copy.label} results`}
                  id={listboxId}
                  role="listbox"
                  {...stylex.props(styles.resultList)}
                >
                  {loading ? (
                    <p
                      role="status"
                      {...stylex.props(foundationStyles.body, styles.noResults)}
                    >
                      Searching…
                    </p>
                  ) : filteredOptions.length > 0 ? (
                    filteredOptions.map((option, index) => (
                      <button
                        aria-selected={index === activeIndex}
                        id={`${listboxId}-option-${index}`}
                        key={option.id}
                        onClick={() => selectOption(option)}
                        onMouseMove={() => setActiveIndex(index)}
                        role="option"
                        type="button"
                        {...stylex.props(
                          styles.result,
                          index === activeIndex && styles.activeResult,
                        )}
                      >
                        <span {...stylex.props(styles.resultName)}>
                          {option.name}
                        </span>
                        <span
                          {...stylex.props(
                            foundationStyles.metadata,
                            styles.resultMeta,
                          )}
                        >
                          {option.id} · {option.meta}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p
                      role="status"
                      {...stylex.props(foundationStyles.body, styles.noResults)}
                    >
                      No matching {copy.plural}.
                    </p>
                  )}
                </div>

                {onCreate && trimmedQuery ? (
                  <button
                    onClick={handleCreate}
                    type="button"
                    {...stylex.props(styles.createAction)}
                  >
                    <span {...stylex.props(styles.createLabel)}>
                      Add “{trimmedQuery}” as a new {copy.singular}
                    </span>
                    <span
                      {...stylex.props(
                        foundationStyles.microLabel,
                        styles.lastResort,
                      )}
                    >
                      Last resort
                    </span>
                  </button>
                ) : null}
              </FloatingPanel>
            ) : null}
          </div>

          <p
            id={helpId}
            {...stylex.props(foundationStyles.metadata, styles.help)}
          >
            {help ?? "↑↓ move · Enter picks · Esc closes"}
          </p>
        </>
      )}
    </div>
  );
}

const styles = stylex.create({
  picker: {
    position: "relative",
    display: "flex",
    width: "100%",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x2,
  },
  label: {
    color: colors.inkMuted,
  },
  searchPosition: {
    position: "relative",
    width: "100%",
  },
  searchControl: {
    display: "flex",
    width: "100%",
    height: controlMetrics.controlHeight,
    minWidth: 0,
    alignItems: "center",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.inset,
    boxShadow: {
      default: "none",
      ":focus-within": effects.focusRing,
    },
  },
  searchInput: {
    boxSizing: "border-box",
    width: "100%",
    minWidth: 0,
    height: "100%",
    paddingRight: space.x2,
    paddingLeft: "14px",
    borderWidth: 0,
    outline: "none",
    backgroundColor: "transparent",
    color: colors.ink,
    fontFamily: fonts.data,
    fontSize: "13px",
    lineHeight: 1.4,
    "::placeholder": {
      color: colors.inkMuted,
      opacity: 1,
    },
  },
  matchCount: {
    flexShrink: 0,
    paddingRight: "14px",
    color: colors.inkMuted,
    whiteSpace: "nowrap",
  },
  overlay: {
    position: "absolute",
    zIndex: 10,
    top: "calc(100% + 4px)",
    right: 0,
    left: 0,
    overflow: "hidden",
  },
  resultList: {
    maxHeight: "252px",
    overflowY: "auto",
  },
  result: {
    display: "flex",
    width: "100%",
    paddingTop: space.x3,
    paddingRight: space.x4,
    paddingBottom: space.x3,
    paddingLeft: space.x4,
    borderWidth: 0,
    borderRadius: 0,
    outline: "none",
    backgroundColor: {
      default: "transparent",
      ":hover": colors.surface,
      ":focus-visible": colors.surface,
    },
    color: colors.ink,
    textAlign: "left",
    cursor: "pointer",
    flexDirection: "column",
    rowGap: space.x1,
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  activeResult: {
    backgroundColor: colors.surface,
  },
  resultName: {
    overflow: "hidden",
    fontFamily: fonts.reading,
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1.3,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  resultMeta: {
    overflow: "hidden",
    color: colors.inkMuted,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  noResults: {
    margin: 0,
    paddingTop: space.x4,
    paddingRight: space.x4,
    paddingBottom: space.x4,
    paddingLeft: space.x4,
    color: colors.inkMuted,
  },
  createAction: {
    display: "flex",
    width: "100%",
    minHeight: controlMetrics.controlHeightLarge,
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: space.x4,
    paddingTop: space.x3,
    paddingRight: space.x4,
    paddingBottom: space.x3,
    paddingLeft: space.x4,
    borderWidth: 0,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    borderRadius: 0,
    outline: "none",
    backgroundColor: {
      default: "transparent",
      ":hover": colors.accentTint,
      ":active": colors.accentTint,
    },
    color: colors.ink,
    textAlign: "left",
    cursor: "pointer",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  createLabel: {
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.35,
  },
  lastResort: {
    flexShrink: 0,
    color: colors.accentDeep,
  },
  help: {
    margin: 0,
    color: colors.inkMuted,
    fontSize: "10px",
  },
  selectedControl: {
    display: "flex",
    width: "100%",
    minHeight: controlMetrics.controlHeight,
    minWidth: 0,
    alignItems: "center",
    columnGap: space.x2,
    paddingLeft: "14px",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.inset,
  },
  selectedName: {
    overflow: "hidden",
    flexGrow: 1,
    minWidth: 0,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: 1.35,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  idChip: {
    flexShrink: 0,
    paddingTop: "3px",
    paddingRight: space.x2,
    paddingBottom: "3px",
    paddingLeft: space.x2,
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.accentTint,
    color: colors.accentDeep,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.2,
    fontVariantNumeric: "tabular-nums",
  },
  clearButton: {
    width: controlMetrics.controlHeight,
    height: controlMetrics.controlHeight,
    flexShrink: 0,
    padding: 0,
    borderWidth: 0,
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: {
      default: "transparent",
      ":hover": colors.surface,
      ":active": colors.surface,
    },
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "20px",
    lineHeight: 1,
    cursor: "pointer",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  selectedDetail: {
    margin: 0,
    color: colors.inkMuted,
  },
});
