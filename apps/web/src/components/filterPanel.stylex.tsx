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
import { FacetRow, FacetRowLoading } from "./facetRow.stylex";
import { LoadingText } from "./feedback.stylex";
import { TextInput } from "./field.stylex";

const NARROW = "@media (max-width: 759px)";

export type FilterPanelProps = {
  ariaLabel: string;
  children: ReactNode;
  onClear?: () => void;
  query?: FilterQueryProps;
  queryVisibility?: "all" | "narrow";
};

/** Keeps a page's filters visible on wide screens and disclosed on narrow ones. */
export function FilterPanel({
  ariaLabel,
  children,
  onClear,
  query,
  queryVisibility = "all",
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
        queryVisibility === "narrow" ? (
          <div {...stylex.props(styles.narrowQuery)}>
            <FilterQueryForm filterToggle={toggle} {...query} />
          </div>
        ) : (
          <FilterQueryForm filterToggle={toggle} {...query} />
        )
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
          query &&
            (queryVisibility === "narrow"
              ? styles.contentAfterNarrowQuery
              : styles.contentAfterQuery),
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

/** The search field at the top of a FilterRail. Enter submits; the route handles results. */
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
  const [draft, setDraft] = useState(query);
  const [draftQuery, setDraftQuery] = useState(query);

  // The route's query owns the field. Drop unsubmitted text whenever it
  // changes so an old draft cannot return when the URL goes back to a value.
  if (draftQuery !== query) {
    setDraftQuery(query);
    setDraft(query);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(draft.trim());
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
          // A sidebar search matches the member search field; Enter submits.
          controlSize={hasFilterToggle ? "sm" : "md"}
          id={id}
          onChange={(event) => setDraft(event.currentTarget.value)}
          placeholder={placeholder}
          type="search"
          value={draft}
        />
      </label>
      {hasFilterToggle ? (
        <span {...stylex.props(styles.mobileFilterToggle)}>{filterToggle}</span>
      ) : null}
      {hasFilterToggle ? (
        <span {...stylex.props(styles.panelDesktopSubmit)}>
          <Button size="sm" type="submit" variant="tonal">
            {submitLabel}
          </Button>
        </span>
      ) : null}
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

/**
 * The filter sidebar beside a list or table: search first, then facet groups,
 * then Clear filters. It has no heading; the search label and group headings
 * say what each part does. Pages hide it on narrow screens, where ListControls
 * shows the same search and groups in its drawer.
 */
export function FilterRail({
  ariaLabel,
  children,
  onClear,
  search,
}: {
  ariaLabel?: string;
  /** Facet groups. */
  children?: ReactNode;
  /** Pass only while a filter or search is applied. */
  onClear?: () => void;
  search?: ReactNode;
}) {
  return (
    <section aria-label={ariaLabel} {...stylex.props(styles.rail)}>
      {search}
      {children}
      {onClear ? (
        <Button onClick={onClear} size="sm" variant="text">
          Clear filters
        </Button>
      ) : null}
    </section>
  );
}

export type FilterRailLoadingGroup = {
  label: string;
  rows: number;
  summary?: boolean;
};

/** Reserves the sidebar's search field and usual groups while counts load. */
export function FilterRailLoading({
  groups,
  searchLabel,
}: {
  groups: readonly FilterRailLoadingGroup[];
  /** The search label, or a placeholder when the route sets it later. */
  searchLabel?: ReactNode;
}) {
  return (
    <div aria-hidden="true" {...stylex.props(styles.rail)}>
      {searchLabel ? (
        <div {...stylex.props(styles.field)}>
          <span {...stylex.props(foundationStyles.fieldLabel)}>
            {searchLabel}
          </span>
          <span {...stylex.props(styles.loadingSearchField)} />
        </div>
      ) : null}
      {groups.map((group) => (
        <FacetGroupLoading key={group.label} {...group} />
      ))}
    </div>
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
  /** A short, non-interactive fact about the whole group, such as a median. */
  summary?: ReactNode;
  total?: number;
};

/** Groups related filter choices without owning their URL state. */
export function FacetGroup({
  label,
  onChange,
  options,
  selected,
  summary,
  total,
}: FacetGroupProps) {
  const id = useId();

  return (
    <section aria-labelledby={id} {...stylex.props(styles.facetGroup)}>
      <SectionHeading id={id} level={3}>
        {label}
      </SectionHeading>
      {summary ? (
        <p {...stylex.props(foundationStyles.metadata, styles.facetSummary)}>
          {summary}
        </p>
      ) : null}
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

/**
 * Reserves one facet group while its counts load. The heading is real; pass
 * `summary` when the finished group shows a summary line.
 */
export function FacetGroupLoading({
  label,
  rows,
  summary = false,
}: {
  label: string;
  rows: number;
  summary?: boolean;
}) {
  return (
    <section aria-hidden="true" {...stylex.props(styles.facetGroup)}>
      <SectionHeading level={3}>{label}</SectionHeading>
      {summary ? (
        <p {...stylex.props(foundationStyles.metadata, styles.facetSummary)}>
          <LoadingText width="60%" />
        </p>
      ) : null}
      <div {...stylex.props(styles.facetRows)}>
        {Array.from({ length: rows }, (_, index) => (
          <FacetRowLoading key={index} />
        ))}
      </div>
    </section>
  );
}

const styles = stylex.create({
  root: {
    minWidth: 0,
  },
  rail: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x6,
  },
  // Matches FilterQuery and the member search: a label above a 40px field.
  loadingSearchField: {
    display: "block",
    height: controlMetrics.controlHeight,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.inset,
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
  contentAfterNarrowQuery: {
    marginTop: { default: 0, [NARROW]: space.x4 },
  },
  narrowQuery: {
    display: "none",
    [NARROW]: {
      display: "block",
    },
  },
  contentOpen: {
    [NARROW]: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 272px), 1fr))",
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
  panelDesktopSubmit: {
    display: { default: "inline-flex", [NARROW]: "none" },
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
  facetSummary: {
    marginTop: space.x1,
    marginBottom: 0,
    color: colors.inkMuted,
    fontVariantNumeric: "tabular-nums",
  },
  facetRows: {
    marginTop: space.x2,
    padding: 0,
    backgroundColor: "transparent",
  },
});
