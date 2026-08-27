import * as stylex from "@stylexjs/stylex";
import { useId } from "react";

import { foundationStyles } from "../../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  fonts,
  space,
} from "../../../styles/tokens.stylex";
import { Button } from "./button.stylex";
import { CountChip } from "./chip.stylex";

export type DuplicateMatch = {
  id: string;
  metadata: string;
  name: string;
};

export type DuplicateMatchListProps = {
  matches: readonly [DuplicateMatch, ...DuplicateMatch[]];
  onSelect: (id: string) => void;
};

/** Gives contributors an escape from creating a duplicate bottle record. */
export function DuplicateMatchList({
  matches,
  onSelect,
}: DuplicateMatchListProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} {...stylex.props(styles.panel)}>
      <div {...stylex.props(styles.heading)}>
        <h2 id={headingId} {...stylex.props(foundationStyles.sectionHeading)}>
          Close matches already exist
        </h2>
        <CountChip count={matches.length} tone="neutral" />
      </div>
      <p {...stylex.props(foundationStyles.body, styles.description)}>
        Different release years are different bottlings. Choose an existing
        record only when the label details match.
      </p>
      <ul {...stylex.props(styles.list)}>
        {matches.map((match) => (
          <li key={match.id} {...stylex.props(styles.row)}>
            <span {...stylex.props(styles.copy)}>
              <strong {...stylex.props(styles.name)}>{match.name}</strong>
              <span {...stylex.props(styles.metadata)}>
                {match.id} · {match.metadata}
              </span>
            </span>
            <Button onClick={() => onSelect(match.id)} size="sm" variant="text">
              This is it →
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const styles = stylex.create({
  panel: {
    boxSizing: "border-box",
    width: "100%",
    padding: space.x4,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  heading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x3,
  },
  description: {
    maxWidth: "62ch",
    marginTop: space.x2,
    color: colors.inkMuted,
  },
  list: {
    margin: 0,
    marginTop: space.x4,
    padding: 0,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    listStyle: "none",
  },
  row: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x3,
    paddingTop: space.x3,
    paddingBottom: space.x3,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  copy: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x1,
  },
  name: {
    overflow: "hidden",
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  metadata: {
    overflow: "hidden",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.35,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});
