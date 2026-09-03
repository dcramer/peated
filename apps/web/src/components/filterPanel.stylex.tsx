"use client";

import * as stylex from "@stylexjs/stylex";
import { ListFilter, Search } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { SectionHeading } from "./sectionHeading.stylex";

import { foundationStyles } from "../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  space,
} from "../styles/tokens.stylex";
import { Button, IconButton } from "./button.stylex";
import { FacetRow } from "./facetRow.stylex";
import { TextInput } from "./field.stylex";

const COMPACT = "@media (max-width: 639px)";
const NARROW = "@media (max-width: 759px)";

export type FilterPanelProps = {
  ariaLabel: string;
  children: ReactNode;
  onClear?: () => void;
  query?: FilterQueryProps;
};

/** Keeps a page's filters visible on wide screens and disclosed on narrow ones. */
export function FilterPanel({
  ariaLabel,
  children,
  onClear,
  query,
}: FilterPanelProps) {
  const contentId = useId();
  const [open, setOpen] = useState(false);
  const toggle = (
    <IconButton
      aria-controls={contentId}
      aria-expanded={open}
      icon={<ListFilter aria-hidden="true" size={16} strokeWidth={1.75} />}
      label={open ? "Hide filters" : "Show filters"}
      onClick={() => setOpen((current) => !current)}
      size="sm"
    />
  );

  return (
    <section aria-label={ariaLabel} {...stylex.props(styles.root)}>
      {query ? (
        <FilterQueryForm filterToggle={toggle} {...query} />
      ) : (
        <button
          aria-controls={contentId}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          type="button"
          {...stylex.props(foundationStyles.interactiveSmall, styles.toggle)}
        >
          <ListFilter aria-hidden="true" size={16} strokeWidth={1.75} />
          Filters
        </button>
      )}
      <div
        id={contentId}
        {...stylex.props(
          styles.content,
          query && styles.contentAfterQuery,
          open && styles.contentOpen,
        )}
      >
        {query ? (
          <div {...stylex.props(styles.panelHeader)}>
            <SectionHeading>Filters</SectionHeading>
            {onClear ? (
              <Button onClick={onClear} size="sm" variant="text">
                Clear all
              </Button>
            ) : null}
          </div>
        ) : null}
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
  return (
    <FilterQueryForm
      label={label}
      onSubmit={onSubmit}
      placeholder={placeholder}
      query={query}
      submitLabel={submitLabel}
    />
  );
}

function FilterQueryForm({
  filterToggle,
  label,
  onSubmit,
  placeholder,
  query,
  submitLabel = "Search",
}: FilterQueryProps & { filterToggle?: ReactNode }) {
  const id = useId();
  const hasFilterToggle = filterToggle !== undefined;
  const [draft, setDraft] = useState({ source: query, value: query });
  const draftValue = draft.source === query ? draft.value : query;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(draftValue.trim());
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      {...stylex.props(
        styles.queryForm,
        hasFilterToggle && styles.panelQueryForm,
      )}
    >
      <label htmlFor={id} {...stylex.props(styles.field)}>
        <span {...stylex.props(foundationStyles.fieldLabel)}>{label}</span>
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
      {hasFilterToggle ? (
        <span {...stylex.props(styles.mobileFilterToggle)}>{filterToggle}</span>
      ) : null}
      <span
        {...stylex.props(
          styles.desktopSubmit,
          hasFilterToggle && styles.panelDesktopSubmit,
        )}
      >
        <Button size="sm" type="submit" variant="tonal">
          {submitLabel}
        </Button>
      </span>
      {hasFilterToggle ? (
        <span {...stylex.props(styles.mobileSubmit)}>
          <IconButton
            icon={<Search aria-hidden="true" size={16} />}
            label={submitLabel}
            size="sm"
            type="submit"
          />
        </span>
      ) : null}
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
      <SectionHeading id={id} level={3}>
        {label}
      </SectionHeading>
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
    },
  },
  contentAfterQuery: {
    marginTop: space.x4,
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
  panelHeader: {
    display: "flex",
    minHeight: controlMetrics.controlHeight,
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x2,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.sectionRule,
    [NARROW]: {
      gridColumn: "1 / -1",
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
  panelQueryForm: {
    [NARROW]: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) auto auto",
    },
  },
  desktopSubmit: {
    display: "inline-flex",
  },
  panelDesktopSubmit: {
    [NARROW]: {
      display: "none",
    },
  },
  mobileFilterToggle: {
    display: "none",
    [NARROW]: {
      display: "inline-flex",
    },
  },
  mobileSubmit: {
    display: "none",
    [NARROW]: {
      display: "inline-flex",
    },
  },
  field: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    gap: space.x2,
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
