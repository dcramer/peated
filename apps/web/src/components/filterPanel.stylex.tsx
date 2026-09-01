"use client";

import * as stylex from "@stylexjs/stylex";
import { ListFilter } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../styles/tokens.stylex";
import { Button } from "./button.stylex";
import { FacetRow } from "./facetRow.stylex";
import { TextInput } from "./field.stylex";

const COMPACT = "@media (max-width: 639px)";
const NARROW = "@media (max-width: 759px)";

export type FilterPanelProps = {
  ariaLabel: string;
  children: ReactNode;
};

/** Keeps a page's filters visible on wide screens and disclosed on narrow ones. */
export function FilterPanel({ ariaLabel, children }: FilterPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <section aria-label={ariaLabel} {...stylex.props(styles.root)}>
      <button
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        type="button"
        {...stylex.props(styles.toggle)}
      >
        <ListFilter aria-hidden="true" size={16} strokeWidth={1.75} />
        Filters
      </button>
      <div {...stylex.props(styles.content, open && styles.contentOpen)}>
        {children}
      </div>
    </section>
  );
}

export type FilterQueryProps = {
  label: string;
  onSubmit: (query: string) => void;
  placeholder: string;
  query: string;
  submitLabel?: string;
};

/** Keeps the query field consistent while the owning route handles results. */
export function FilterQuery({
  label,
  onSubmit,
  placeholder,
  query,
  submitLabel = "Search",
}: FilterQueryProps) {
  const id = useId();
  const [draft, setDraft] = useState({ source: query, value: query });
  const draftValue = draft.source === query ? draft.value : query;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(draftValue.trim());
  }

  return (
    <form onSubmit={submit} role="search" {...stylex.props(styles.queryForm)}>
      <label htmlFor={id} {...stylex.props(styles.field)}>
        <span {...stylex.props(styles.heading)}>{label}</span>
        <TextInput
          aria-label={label}
          controlSize="sm"
          id={id}
          onChange={(event) =>
            setDraft({ source: query, value: event.currentTarget.value })
          }
          placeholder={placeholder}
          type="search"
          value={draftValue}
        />
      </label>
      <Button size="sm" type="submit" variant="tonal">
        {submitLabel}
      </Button>
    </form>
  );
}

export type FacetGroupOption = {
  count?: number | null;
  label: string;
  value: string;
};

export type FacetGroupProps = {
  label: string;
  onChange: (value: string) => void;
  options: readonly FacetGroupOption[];
  selected?: string;
  total?: number;
};

/** Groups related filter choices without owning their URL state. */
export function FacetGroup({
  label,
  onChange,
  options,
  selected,
  total,
}: FacetGroupProps) {
  const id = useId();

  return (
    <section aria-labelledby={id} {...stylex.props(styles.facetGroup)}>
      <h3 id={id} {...stylex.props(styles.heading)}>
        {label}
      </h3>
      <div {...stylex.props(styles.facetRows)}>
        {options.map((option) => {
          const isSelected = selected === option.value;
          const rowProps = {
            label: option.label,
            onClick: () => onChange(isSelected ? "" : option.value),
            selected: isSelected,
          };

          if (option.count === null) {
            return <FacetRow {...rowProps} count={null} key={option.value} />;
          }
          return option.count === undefined || total === undefined ? (
            <FacetRow {...rowProps} key={option.value} />
          ) : (
            <FacetRow
              {...rowProps}
              count={option.count}
              key={option.value}
              total={total}
            />
          );
        })}
      </div>
    </section>
  );
}

const styles = stylex.create({
  root: {
    minWidth: 0,
  },
  toggle: {
    display: "none",
    width: "100%",
    height: controlMetrics.controlHeight,
    alignItems: "center",
    justifyContent: "center",
    gap: space.x2,
    paddingRight: space.x3,
    paddingLeft: space.x3,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.sectionRule,
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: {
      default: "transparent",
      ":hover": colors.surface,
      ":active": colors.surface,
    },
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
    [NARROW]: {
      display: "flex",
    },
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: space.x4,
    [NARROW]: {
      display: "none",
      paddingTop: space.x4,
    },
  },
  contentOpen: {
    [NARROW]: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    [COMPACT]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  queryForm: {
    display: "flex",
    alignItems: "flex-end",
    gap: space.x2,
    [NARROW]: {
      gridColumn: "1 / -1",
    },
  },
  field: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    gap: space.x2,
  },
  heading: {
    margin: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontWeight: 400,
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  facetGroup: {
    minWidth: 0,
  },
  facetRows: {
    marginTop: space.x2,
    padding: 0,
    backgroundColor: "transparent",
  },
});
