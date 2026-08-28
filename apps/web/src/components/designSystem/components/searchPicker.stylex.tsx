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
import { Chip } from "./chip.stylex";
import { FloatingPanel } from "./feedback.stylex";

export type SearchPickerOption = {
  detail?: string;
  id: number | string;
  label: string;
};

export type SearchPickerProps = {
  emptyText?: string;
  help?: string;
  label: string;
  loading?: boolean;
  onChange: (value: readonly SearchPickerOption[]) => void;
  onQueryChange?: (query: string) => void;
  options: readonly SearchPickerOption[];
  placeholder: string;
  value: readonly SearchPickerOption[];
};

/** Selects several supplied records while the caller owns remote search. */
export function SearchPicker({
  emptyText = "No matches.",
  help,
  label,
  loading = false,
  onChange,
  onQueryChange,
  options,
  placeholder,
  value,
}: SearchPickerProps) {
  const generatedId = useId();
  const inputId = `${generatedId}-input`;
  const listboxId = `${generatedId}-listbox`;
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const availableOptions = useMemo(() => {
    const selectedIds = new Set(value.map((item) => item.id));
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return options.filter(
      (option) =>
        !selectedIds.has(option.id) &&
        (!normalizedQuery ||
          option.label.toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [options, query, value]);
  const activeOption = availableOptions[activeIndex];

  function selectOption(option: SearchPickerOption) {
    onChange([...value, option]);
    setQuery("");
    onQueryChange?.("");
    setActiveIndex(-1);
    setIsOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      if (availableOptions.length) {
        setActiveIndex((current) =>
          event.key === "ArrowDown"
            ? current >= availableOptions.length - 1
              ? 0
              : current + 1
            : current <= 0
              ? availableOptions.length - 1
              : current - 1,
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

  return (
    <div onBlur={handleBlur} {...stylex.props(styles.root)}>
      <label
        htmlFor={inputId}
        {...stylex.props(foundationStyles.fieldLabel, styles.label)}
      >
        {label}
      </label>
      {value.length ? (
        <div
          aria-label={`Selected ${label}`}
          {...stylex.props(styles.selected)}
        >
          {value.map((option) => (
            <Chip
              aria-label={`Remove ${option.label}`}
              key={option.id}
              onClick={() =>
                onChange(value.filter((item) => item.id !== option.id))
              }
              variant="tinted"
            >
              {option.label} ×
            </Chip>
          ))}
        </div>
      ) : null}
      <div {...stylex.props(styles.position)}>
        <input
          aria-activedescendant={
            activeOption ? `${listboxId}-option-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          aria-controls={listboxId}
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
          placeholder={placeholder}
          role="combobox"
          type="search"
          value={query}
          {...stylex.props(styles.input)}
        />
        {isOpen ? (
          <FloatingPanel {...stylex.props(styles.overlay)}>
            <div
              aria-label={`${label} results`}
              id={listboxId}
              role="listbox"
              {...stylex.props(styles.results)}
            >
              {loading ? (
                <p role="status" {...stylex.props(styles.empty)}>
                  Searching…
                </p>
              ) : availableOptions.length ? (
                availableOptions.map((option, index) => (
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
                    <span {...stylex.props(styles.resultLabel)}>
                      {option.label}
                    </span>
                    {option.detail ? (
                      <span {...stylex.props(styles.detail)}>
                        {option.detail}
                      </span>
                    ) : null}
                  </button>
                ))
              ) : (
                <p role="status" {...stylex.props(styles.empty)}>
                  {emptyText}
                </p>
              )}
            </div>
          </FloatingPanel>
        ) : null}
      </div>
      {help ? (
        <p {...stylex.props(foundationStyles.metadata, styles.help)}>{help}</p>
      ) : null}
    </div>
  );
}

const styles = stylex.create({
  root: {
    position: "relative",
    display: "flex",
    width: "100%",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x2,
  },
  label: { color: colors.inkMuted },
  selected: { display: "flex", gap: space.x2, flexWrap: "wrap" },
  position: { position: "relative" },
  input: {
    boxSizing: "border-box",
    width: "100%",
    height: controlMetrics.controlHeight,
    paddingRight: "14px",
    paddingLeft: "14px",
    borderWidth: 0,
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: colors.inset,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.4,
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
    "::placeholder": { color: colors.inkMuted, opacity: 1 },
    "::-webkit-search-cancel-button": { appearance: "none" },
  },
  overlay: {
    position: "absolute",
    zIndex: 10,
    top: "calc(100% + 4px)",
    right: 0,
    left: 0,
    overflow: "hidden",
  },
  results: { maxHeight: "280px", overflowY: "auto" },
  result: {
    display: "flex",
    width: "100%",
    flexDirection: "column",
    alignItems: "flex-start",
    rowGap: space.x1,
    padding: space.x3,
    borderWidth: 0,
    backgroundColor: { default: "transparent", ":hover": colors.inset },
    color: colors.ink,
    textAlign: "left",
    cursor: "pointer",
  },
  activeResult: { backgroundColor: colors.inset },
  resultLabel: {
    fontFamily: fonts.display,
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1.2,
  },
  detail: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.3,
  },
  empty: {
    margin: 0,
    padding: space.x4,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.4,
  },
  help: { margin: 0, color: colors.inkMuted },
});
