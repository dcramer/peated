"use client";

import * as stylex from "@stylexjs/stylex";
import type { FocusEvent } from "react";
import { useId, useMemo, useState } from "react";

import { foundationStyles } from "../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../styles/tokens.stylex";
import { Button } from "./button.stylex";
import { Chip } from "./chip.stylex";
import { FloatingPanel } from "./feedback.stylex";
import { useListboxNavigation } from "./useListboxNavigation";

const COMPACT = "@media (max-width: 639px)";

export type NotePickerOption = {
  category: string;
  common?: boolean;
  name: string;
  usageCount: number;
};

export type NotePickerProps = {
  notes: readonly NotePickerOption[];
  onChange: (value: readonly string[]) => void;
  onClose?: () => void;
  onConfirm?: (value: readonly string[]) => void;
  value: readonly string[];
};

export type NotePickerFieldProps = Pick<
  NotePickerProps,
  "notes" | "onChange" | "value"
> & {
  id?: string;
};

/** Keeps the full picker available without replacing the surrounding form. */
export function NotePickerField({
  id,
  notes,
  onChange,
  value,
}: NotePickerFieldProps) {
  const generatedId = useId();
  const inputId = id ?? `${generatedId}-input`;
  const listboxId = `${generatedId}-listbox`;
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return [];

    return notes
      .filter(
        (note) =>
          !value.includes(note.name) &&
          note.name.toLocaleLowerCase().includes(normalizedQuery),
      )
      .sort(
        (left, right) =>
          Number(Boolean(right.common)) - Number(Boolean(left.common)) ||
          right.usageCount - left.usageCount,
      )
      .slice(0, 6);
  }, [notes, query, value]);
  const suggestionsOpen = !isBrowserOpen && query.trim().length > 0;

  const {
    activeIndex,
    activeItem: activeMatch,
    handleKeyDown,
    resetNavigation,
    setActiveIndex,
  } = useListboxNavigation({
    items: matches,
    onClose: () => {
      setQuery("");
      setIsBrowserOpen(false);
    },
    onOpen: () => undefined,
    onSelect: (note) => {
      onChange([...value, note.name]);
      setQuery("");
    },
    open: suggestionsOpen,
  });

  function selectNote(note: NotePickerOption) {
    onChange([...value, note.name]);
    setQuery("");
    resetNavigation();
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setQuery("");
      resetNavigation();
    }
  }

  return (
    <div onBlur={handleBlur} {...stylex.props(styles.fieldRoot)}>
      <div {...stylex.props(styles.fieldControl)}>
        {value.map((note) => (
          <Chip
            aria-label={`Remove ${note}`}
            key={note}
            onClick={() => onChange(value.filter((item) => item !== note))}
            variant="tinted"
          >
            {note} ×
          </Chip>
        ))}
        <input
          aria-activedescendant={
            activeMatch ? `${listboxId}-option-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          aria-controls={suggestionsOpen ? listboxId : undefined}
          aria-expanded={suggestionsOpen}
          aria-label="Find a tasting note"
          id={inputId}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            resetNavigation();
          }}
          onKeyDown={handleKeyDown}
          placeholder={value.length ? "Add another note" : "Find a note"}
          role="combobox"
          type="search"
          value={query}
          {...stylex.props(styles.fieldInput)}
        />
        <Button
          aria-expanded={isBrowserOpen}
          aria-haspopup="dialog"
          onClick={() => {
            setQuery("");
            resetNavigation();
            setIsBrowserOpen(true);
          }}
          size="sm"
          variant="tonal"
        >
          Browse
        </Button>
      </div>

      {suggestionsOpen ? (
        <FloatingPanel {...stylex.props(styles.suggestionOverlay)}>
          <div id={listboxId} role="listbox">
            {matches.length ? (
              matches.map((note, index) => (
                <button
                  aria-selected={index === activeIndex}
                  id={`${listboxId}-option-${index}`}
                  key={note.name}
                  onClick={() => selectNote(note)}
                  onMouseMove={() => setActiveIndex(index)}
                  role="option"
                  type="button"
                  {...stylex.props(
                    styles.suggestion,
                    index === activeIndex && styles.activeSuggestion,
                  )}
                >
                  <span {...stylex.props(styles.suggestionName)}>
                    {note.name}
                  </span>
                  <span {...stylex.props(styles.suggestionCount)}>
                    used {note.usageCount.toLocaleString("en-US")} times
                  </span>
                </button>
              ))
            ) : (
              <p role="status" {...stylex.props(styles.fieldEmpty)}>
                No existing notes match “{query.trim()}”.
              </p>
            )}
          </div>
        </FloatingPanel>
      ) : null}

      {isBrowserOpen ? (
        <div {...stylex.props(styles.fieldOverlay)}>
          <NotePicker
            notes={notes}
            onChange={onChange}
            onClose={() => setIsBrowserOpen(false)}
            onConfirm={() => setIsBrowserOpen(false)}
            value={value}
          />
        </div>
      ) : null}

      {value.length ? (
        <p aria-live="polite" {...stylex.props(styles.fieldSummary)}>
          {value.length} {value.length === 1 ? "note" : "notes"} selected
        </p>
      ) : null}
    </div>
  );
}

export function NotePicker({
  notes,
  onChange,
  onClose,
  onConfirm,
  value,
}: NotePickerProps) {
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const resultCountId = `${generatedId}-result-count`;
  const categories = useMemo(
    () => Array.from(new Set(notes.map((note) => note.category))),
    [notes],
  );
  const [activeCategory, setActiveCategory] = useState(
    () => categories[0] ?? "",
  );
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const visibleNotes = useMemo(() => {
    const normalizedQuery = trimmedQuery.toLocaleLowerCase();
    const filtered = notes.filter((note) =>
      normalizedQuery
        ? note.name.toLocaleLowerCase().includes(normalizedQuery)
        : note.category === activeCategory,
    );

    return [...filtered].sort(
      (left, right) =>
        Number(Boolean(right.common)) - Number(Boolean(left.common)),
    );
  }, [activeCategory, notes, trimmedQuery]);

  function toggleNote(noteName: string) {
    onChange(
      value.includes(noteName)
        ? value.filter((selectedNote) => selectedNote !== noteName)
        : [...value, noteName],
    );
  }

  const selectedSummary = value.length
    ? value.map((note) => note.toLocaleLowerCase()).join(", ")
    : "none";

  return (
    <FloatingPanel
      aria-labelledby={titleId}
      data-state="open"
      role="dialog"
      {...stylex.props(styles.picker)}
    >
      <div {...stylex.props(styles.header)}>
        <h3
          id={titleId}
          {...stylex.props(foundationStyles.sectionHeading, styles.title)}
        >
          Notes
        </h3>
        <input
          aria-describedby={resultCountId}
          aria-label="Search notes"
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={`Search ${notes.length.toLocaleString("en-US")} notes`}
          type="search"
          value={query}
          {...stylex.props(styles.search)}
        />
        {onClose ? (
          <button
            aria-label="Close note picker"
            onClick={onClose}
            type="button"
            {...stylex.props(styles.closeButton)}
          >
            ×
          </button>
        ) : null}
      </div>

      <div aria-label="Note categories" {...stylex.props(styles.categories)}>
        {categories.map((category) => {
          const isActive = category === activeCategory && !trimmedQuery;
          return (
            <button
              aria-pressed={isActive}
              key={category}
              onClick={() => {
                setActiveCategory(category);
                setQuery("");
              }}
              type="button"
              {...stylex.props(
                styles.category,
                isActive && styles.activeCategory,
              )}
            >
              {category}
            </button>
          );
        })}
      </div>

      <div {...stylex.props(styles.noteArea)}>
        <p
          id={resultCountId}
          aria-live="polite"
          {...stylex.props(foundationStyles.microLabel, styles.noteContext)}
        >
          {visibleNotes.length.toLocaleString("en-US")}{" "}
          {trimmedQuery
            ? "matches"
            : `${activeCategory.toLocaleLowerCase()} notes`}
          {!trimmedQuery
            ? " · common for this bottle first"
            : " · all categories"}
        </p>
        {visibleNotes.length > 0 ? (
          <div aria-label="Available notes" {...stylex.props(styles.notes)}>
            {visibleNotes.map((note) => {
              const isSelected = value.includes(note.name);
              return (
                <button
                  aria-label={`${isSelected ? "Remove" : "Add"} ${note.name}`}
                  aria-pressed={isSelected}
                  data-note-state={
                    isSelected ? "picked" : note.common ? "common" : "available"
                  }
                  key={note.name}
                  onClick={() => toggleNote(note.name)}
                  title={`Used ${note.usageCount.toLocaleString("en-US")} times`}
                  type="button"
                  {...stylex.props(
                    styles.note,
                    isSelected
                      ? styles.selectedNote
                      : note.common
                        ? styles.commonNote
                        : styles.availableNote,
                  )}
                >
                  {note.name} {isSelected ? "×" : null}
                </button>
              );
            })}
          </div>
        ) : (
          <p {...stylex.props(foundationStyles.body, styles.noResults)}>
            No notes match “{trimmedQuery}”.
          </p>
        )}
      </div>

      <footer {...stylex.props(styles.footer)}>
        <p
          aria-live="polite"
          {...stylex.props(foundationStyles.metadata, styles.summary)}
        >
          {value.length} picked · {selectedSummary}
        </p>
        {onConfirm ? (
          <Button onClick={() => onConfirm(value)} size="md" variant="accent">
            Done
          </Button>
        ) : null}
      </footer>
    </FloatingPanel>
  );
}

const styles = stylex.create({
  fieldRoot: {
    position: "relative",
    minWidth: 0,
  },
  fieldControl: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    minWidth: 0,
    minHeight: controlMetrics.controlHeight,
    alignItems: "center",
    gap: space.x2,
    paddingTop: space.x1,
    paddingRight: space.x1,
    paddingBottom: space.x1,
    paddingLeft: space.x2,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: {
      default: colors.fieldRule,
      ":hover": colors.inkMuted,
      ":focus-within": colors.accent,
    },
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.fieldBackground,
    flexWrap: "wrap",
    boxShadow: {
      default: "none",
      ":focus-within": `inset 0 0 0 1px ${colors.accent}`,
    },
  },
  fieldInput: {
    minWidth: "120px",
    height: controlMetrics.controlHeightSmall,
    flex: 1,
    padding: 0,
    borderWidth: 0,
    outline: "none",
    backgroundColor: "transparent",
    color: colors.ink,
    fontFamily: fonts.data,
    fontSize: "12px",
    lineHeight: 1.4,
    "::placeholder": {
      color: colors.inkMuted,
      opacity: 1,
    },
    "::-webkit-search-cancel-button": {
      appearance: "none",
    },
  },
  suggestionOverlay: {
    position: "absolute",
    zIndex: 21,
    top: "calc(100% + 4px)",
    right: 0,
    left: 0,
    overflow: "hidden",
  },
  suggestion: {
    display: "flex",
    width: "100%",
    minWidth: 0,
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x3,
    paddingTop: space.x3,
    paddingRight: space.x4,
    paddingBottom: space.x3,
    paddingLeft: space.x4,
    borderWidth: 0,
    outline: "none",
    backgroundColor: {
      default: "transparent",
      ":hover": colors.inset,
      ":focus-visible": colors.inset,
    },
    color: colors.ink,
    textAlign: "left",
    cursor: "pointer",
  },
  activeSuggestion: {
    backgroundColor: colors.inset,
  },
  suggestionName: {
    overflow: "hidden",
    fontFamily: fonts.display,
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.25,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  suggestionCount: {
    flexShrink: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.3,
  },
  fieldEmpty: {
    margin: 0,
    padding: space.x4,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.4,
  },
  fieldOverlay: {
    position: "absolute",
    zIndex: 20,
    top: "calc(100% + 4px)",
    left: 0,
    width: "min(640px, calc(100vw - 48px))",
  },
  fieldSummary: {
    margin: 0,
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.3,
  },
  picker: {
    width: "100%",
    maxWidth: "640px",
    overflow: "hidden",
  },
  header: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    alignItems: "center",
    columnGap: space.x3,
    paddingTop: space.x4,
    paddingRight: { default: space.x4, [COMPACT]: space.x3 },
    paddingBottom: space.x3,
    paddingLeft: { default: space.x4, [COMPACT]: space.x3 },
  },
  title: {
    color: colors.ink,
  },
  search: {
    boxSizing: "border-box",
    width: "100%",
    minWidth: 0,
    height: controlMetrics.controlHeight,
    paddingRight: space.x3,
    paddingLeft: space.x3,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: {
      default: colors.fieldRule,
      ":hover": colors.inkMuted,
      ":focus": colors.accent,
    },
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: colors.fieldBackground,
    color: colors.ink,
    fontFamily: fonts.data,
    fontSize: "12px",
    lineHeight: 1.4,
    boxShadow: {
      default: "none",
      ":focus": `inset 0 0 0 1px ${colors.accent}`,
    },
    "::placeholder": {
      color: colors.inkMuted,
      opacity: 1,
    },
    "::-webkit-search-cancel-button": {
      appearance: "none",
    },
  },
  closeButton: {
    width: controlMetrics.controlHeight,
    height: controlMetrics.controlHeight,
    padding: 0,
    borderWidth: 0,
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: {
      default: "transparent",
      ":hover": colors.inset,
      ":active": colors.inset,
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
  categories: {
    display: "flex",
    columnGap: space.x2,
    rowGap: space.x2,
    paddingRight: { default: space.x4, [COMPACT]: space.x3 },
    paddingBottom: space.x4,
    paddingLeft: { default: space.x4, [COMPACT]: space.x3 },
    flexWrap: "wrap",
  },
  category: {
    minHeight: controlMetrics.controlHeightSmall,
    paddingRight: "11px",
    paddingLeft: "11px",
    borderWidth: 0,
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    backgroundColor: { default: "transparent", ":hover": colors.surface },
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1,
    cursor: "pointer",
    boxShadow: {
      default: `inset 0 0 0 1px ${colors.sectionRule}`,
      ":focus-visible": effects.focusRing,
    },
  },
  activeCategory: {
    backgroundColor: {
      default: colors.ink,
      ":hover": colors.ink,
      ":active": colors.ink,
    },
    boxShadow: "none",
    color: colors.ground,
  },
  noteArea: {
    paddingRight: { default: space.x4, [COMPACT]: space.x3 },
    paddingBottom: space.x6,
    paddingLeft: { default: space.x4, [COMPACT]: space.x3 },
  },
  noteContext: {
    margin: 0,
    marginBottom: space.x3,
    color: colors.inkMuted,
  },
  notes: {
    display: "flex",
    columnGap: space.x2,
    rowGap: space.x2,
    flexWrap: "wrap",
  },
  note: {
    minHeight: controlMetrics.controlHeightSmall,
    paddingRight: "11px",
    paddingLeft: "11px",
    borderWidth: 0,
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1,
    cursor: "pointer",
    opacity: {
      default: 1,
      ":hover": 0.82,
    },
    boxShadow: {
      default: `inset 0 0 0 1px ${colors.sectionRule}`,
      ":focus-visible": effects.focusRing,
    },
  },
  selectedNote: {
    backgroundColor: colors.accent,
    color: colors.ground,
    boxShadow: "none",
  },
  commonNote: {
    backgroundColor: "transparent",
    color: colors.accentDeep,
    boxShadow: `inset 0 0 0 1px ${colors.accent}`,
  },
  availableNote: {
    backgroundColor: "transparent",
    color: colors.ink,
  },
  noResults: {
    color: colors.inkMuted,
  },
  footer: {
    display: "flex",
    minHeight: "68px",
    alignItems: "center",
    columnGap: space.x3,
    rowGap: space.x3,
    paddingTop: space.x3,
    paddingRight: { default: space.x4, [COMPACT]: space.x3 },
    paddingBottom: space.x3,
    paddingLeft: { default: space.x4, [COMPACT]: space.x3 },
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    backgroundColor: "transparent",
    flexWrap: "wrap",
  },
  summary: {
    minWidth: "160px",
    flexGrow: 1,
    margin: 0,
    color: colors.inkMuted,
  },
});
