"use client";

import * as stylex from "@stylexjs/stylex";
import type { FocusEvent, ReactNode } from "react";
import { useId, useMemo, useState } from "react";

import { foundationStyles } from "../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../styles/tokens.stylex";
import { Chip } from "./chip.stylex";
import { FloatingPanel } from "./feedback.stylex";
import { ValidationMessage } from "./field.stylex";
import { useListboxNavigation } from "./useListboxNavigation";

export type SearchPickerOption = {
  detail?: string;
  id: number | string;
  label: string;
  selectedDetail?: string;
};

export type SearchPickerProps = {
  createHint?: ReactNode;
  disabled?: boolean;
  emptyText?: string;
  error?: ReactNode;
  getCreateLabel?: (query: string) => ReactNode;
  help?: string;
  label: string;
  loading?: boolean;
  onChange: (value: readonly SearchPickerOption[]) => void;
  onCreate?: (query: string) => void;
  onQueryChange?: (query: string) => void;
  options: readonly SearchPickerOption[];
  placeholder: string;
  required?: boolean;
  value: readonly SearchPickerOption[];
};

export type SearchSelectProps = Omit<
  SearchPickerProps,
  "onChange" | "value"
> & {
  onChange: (value: SearchPickerOption | null) => void;
  value: SearchPickerOption | null;
};

/** Selects one supplied record while the caller owns remote search. */
export function SearchSelect({ onChange, value, ...props }: SearchSelectProps) {
  return (
    <PickerControl
      {...props}
      onChange={(next) => onChange(next.at(-1) ?? null)}
      selectionMode="single"
      value={value ? [value] : []}
    />
  );
}

/** Selects several supplied records while the caller owns remote search. */
export function SearchPicker({
  createHint,
  disabled = false,
  emptyText = "No matches.",
  error,
  getCreateLabel,
  help,
  label,
  loading = false,
  onChange,
  onCreate,
  onQueryChange,
  options,
  placeholder,
  required = false,
  value,
}: SearchPickerProps) {
  return (
    <PickerControl
      createHint={createHint}
      disabled={disabled}
      emptyText={emptyText}
      error={error}
      getCreateLabel={getCreateLabel}
      help={help}
      label={label}
      loading={loading}
      onChange={onChange}
      onCreate={onCreate}
      onQueryChange={onQueryChange}
      options={options}
      placeholder={placeholder}
      required={required}
      selectionMode="multiple"
      value={value}
    />
  );
}

function PickerControl({
  createHint,
  disabled = false,
  emptyText = "No matches.",
  error,
  getCreateLabel,
  help,
  label,
  loading = false,
  onChange,
  onCreate,
  onQueryChange,
  options,
  placeholder,
  required = false,
  selectionMode,
  value,
}: SearchPickerProps & { selectionMode: "multiple" | "single" }) {
  const generatedId = useId();
  const inputId = `${generatedId}-input`;
  const listboxId = `${generatedId}-listbox`;
  const errorId = `${generatedId}-error`;
  const helpId = `${generatedId}-help`;
  const descriptionId = error ? errorId : help ? helpId : undefined;
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
  const trimmedQuery = query.trim();

  const {
    activeIndex,
    activeItem: activeOption,
    handleKeyDown,
    resetNavigation,
    setActiveIndex,
  } = useListboxNavigation({
    items: availableOptions,
    onClose: () => setIsOpen(false),
    onOpen: () => setIsOpen(true),
    onSelect: selectOption,
    open: isOpen,
  });

  function selectOption(option: SearchPickerOption) {
    if (disabled) return;
    onChange([...value, option]);
    setQuery("");
    onQueryChange?.("");
    resetNavigation();
    setIsOpen(false);
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      resetNavigation();
      setIsOpen(false);
    }
  }

  return (
    <div onBlur={handleBlur} {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.labelRow)}>
        <label
          htmlFor={
            selectionMode === "single" && value.length ? undefined : inputId
          }
          {...stylex.props(foundationStyles.fieldLabel, styles.label)}
        >
          {label}
        </label>
        {required ? (
          <span {...stylex.props(foundationStyles.microLabel, styles.required)}>
            Required
          </span>
        ) : null}
      </div>
      {selectionMode === "single" && value[0] ? (
        <div
          {...stylex.props(
            styles.selectedControl,
            Boolean(error) && styles.invalid,
          )}
        >
          <span {...stylex.props(styles.selectedCopy)}>
            <span {...stylex.props(styles.selectedName)}>{value[0].label}</span>
            {(value[0].selectedDetail ?? value[0].detail) ? (
              <span {...stylex.props(styles.selectedDetail)}>
                {value[0].selectedDetail ?? value[0].detail}
              </span>
            ) : null}
          </span>
          <button
            aria-label={`Clear ${value[0].label}`}
            disabled={disabled}
            onClick={() => onChange([])}
            type="button"
            {...stylex.props(styles.clearButton)}
          >
            ×
          </button>
        </div>
      ) : value.length ? (
        <div
          aria-label={`Selected ${label}`}
          {...stylex.props(styles.selected)}
        >
          {value.map((option) => (
            <Chip
              aria-label={`Remove ${option.label}`}
              key={option.id}
              onClick={() =>
                !disabled &&
                onChange(value.filter((item) => item.id !== option.id))
              }
              variant="tinted"
            >
              {option.label} ×
            </Chip>
          ))}
        </div>
      ) : null}
      {selectionMode === "single" && value.length ? null : (
        <div {...stylex.props(styles.position)}>
          <input
            aria-activedescendant={
              activeOption ? `${listboxId}-option-${activeIndex}` : undefined
            }
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={isOpen}
            aria-describedby={descriptionId}
            aria-invalid={error ? true : undefined}
            aria-required={required || undefined}
            id={inputId}
            onChange={(event) => {
              if (disabled) return;
              const nextQuery = event.currentTarget.value;
              setQuery(nextQuery);
              onQueryChange?.(nextQuery);
              resetNavigation();
              setIsOpen(true);
            }}
            onFocus={() => !disabled && setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            role="combobox"
            type="search"
            value={query}
            disabled={disabled}
            {...stylex.props(styles.input, Boolean(error) && styles.invalid)}
          />
          {isOpen && !disabled ? (
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
              {onCreate && trimmedQuery ? (
                <button
                  onClick={() => {
                    onCreate(trimmedQuery);
                    setQuery("");
                    onQueryChange?.("");
                    resetNavigation();
                    setIsOpen(false);
                  }}
                  type="button"
                  {...stylex.props(styles.createAction)}
                >
                  <span>
                    {getCreateLabel?.(trimmedQuery) ?? `Add “${trimmedQuery}”`}
                  </span>
                  {createHint ? (
                    <span {...stylex.props(styles.createHint)}>
                      {createHint}
                    </span>
                  ) : null}
                </button>
              ) : null}
            </FloatingPanel>
          ) : null}
        </div>
      )}
      {error ? (
        <ValidationMessage id={errorId}>{error}</ValidationMessage>
      ) : help ? (
        <p
          id={helpId}
          {...stylex.props(foundationStyles.metadata, styles.help)}
        >
          {help}
        </p>
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
  labelRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    columnGap: space.x4,
  },
  label: { color: colors.inkMuted },
  required: { color: colors.accentDeep },
  selected: { display: "flex", gap: space.x2, flexWrap: "wrap" },
  selectedControl: {
    display: "flex",
    width: "100%",
    minWidth: 0,
    minHeight: controlMetrics.controlHeight,
    alignItems: "center",
    gap: space.x2,
    paddingLeft: "14px",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.inset,
  },
  selectedCopy: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
  },
  selectedName: {
    overflow: "hidden",
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: 1.25,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  selectedDetail: {
    overflow: "hidden",
    marginTop: "2px",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.2,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
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
  invalid: { boxShadow: effects.errorRing },
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
  createAction: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x3,
    padding: space.x3,
    borderWidth: 0,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    backgroundColor: { default: colors.surface, ":hover": colors.inset },
    color: colors.accentDeep,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 700,
    textAlign: "left",
    cursor: "pointer",
  },
  createHint: {
    flexShrink: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontWeight: 500,
    letterSpacing: "0.06em",
    lineHeight: 1.2,
    textTransform: "uppercase",
  },
  help: { margin: 0, color: colors.inkMuted },
});
