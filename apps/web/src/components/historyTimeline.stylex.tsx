import * as stylex from "@stylexjs/stylex";

import { foundationStyles } from "../styles/foundations.stylex";
import { colors, space } from "../styles/tokens.stylex";
import { TextLink } from "./textLink.stylex";

const COMPACT = "@media (max-width: 639px)";

export type HistoryState = "operating" | "silent";

export type HistoryEvent = {
  date: string;
  description?: string;
  note?: string;
  source?: {
    href: string;
    label?: string;
  };
  state: HistoryState;
  title?: string;
};

export type HistoryTimelineProps = {
  events: readonly HistoryEvent[];
  summary?: string;
};

/** Shows dated entity history while preserving periods of operation and silence. */
export function HistoryTimeline({ events, summary }: HistoryTimelineProps) {
  return (
    <div {...stylex.props(styles.root)}>
      <ol {...stylex.props(styles.list)}>
        {events.map((event, index) => (
          <li
            key={`${event.date}-${event.title ?? index}`}
            {...stylex.props(
              styles.event,
              event.state === "operating" ? styles.operating : styles.silent,
            )}
          >
            <time {...stylex.props(foundationStyles.metadata, styles.date)}>
              {event.date}
            </time>
            <div {...stylex.props(styles.content)}>
              <span {...stylex.props(styles.visuallyHidden)}>
                {event.state === "operating"
                  ? "Operating period. "
                  : "Silent period. "}
              </span>
              {event.title ? (
                <strong {...stylex.props(foundationStyles.rowTitle)}>
                  {event.title}
                </strong>
              ) : null}
              {event.description ? (
                <p {...stylex.props(foundationStyles.body)}>
                  {event.description}
                </p>
              ) : null}
              {event.note ? (
                <span {...stylex.props(foundationStyles.metadata, styles.note)}>
                  {event.note}
                </span>
              ) : null}
              {event.source ? (
                <span {...stylex.props(foundationStyles.metadata)}>
                  <TextLink
                    href={event.source.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {event.source.label ?? "Source"}
                  </TextLink>
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {summary ? (
        <p {...stylex.props(foundationStyles.metadata, styles.summary)}>
          {summary}
        </p>
      ) : null}
    </div>
  );
}

const styles = stylex.create({
  root: {
    width: "100%",
  },
  list: {
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  event: {
    boxSizing: "border-box",
    display: "grid",
    gridTemplateColumns: {
      default: "84px minmax(0, 1fr)",
      [COMPACT]: "68px minmax(0, 1fr)",
    },
    columnGap: { default: space.x4, [COMPACT]: space.x3 },
    minWidth: 0,
    paddingTop: space.x4,
    paddingRight: { default: space.x4, [COMPACT]: space.x2 },
    paddingBottom: space.x4,
    paddingLeft: { default: space.x4, [COMPACT]: space.x3 },
    borderLeftWidth: "4px",
    borderLeftStyle: "solid",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  operating: {
    borderLeftColor: colors.accent,
  },
  silent: {
    borderLeftColor: colors.verdictTrack,
  },
  date: {
    color: colors.inkMuted,
    fontVariantNumeric: "tabular-nums",
  },
  content: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    alignItems: "flex-start",
    rowGap: space.x2,
  },
  note: {
    color: colors.inkMuted,
  },

  summary: {
    marginTop: space.x3,
    color: colors.inkMuted,
  },
  visuallyHidden: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
  },
});
