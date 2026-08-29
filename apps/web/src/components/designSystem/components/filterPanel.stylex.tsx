"use client";

import * as stylex from "@stylexjs/stylex";
import { ListFilter } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../../styles/tokens.stylex";

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
    borderWidth: 0,
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: colors.inset,
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
});
