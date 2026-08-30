import * as stylex from "@stylexjs/stylex";

import { colors, fonts } from "../styles/tokens.stylex";

export type PassportStamp = {
  label: string;
  stamped: boolean;
};

type ClosedPassport = {
  kind: "closed";
  stamps: readonly [PassportStamp, ...PassportStamp[]];
  unit: string;
};

type OpenPassport = {
  count: number;
  kind: "open";
  nextStampIn?: number;
  unit: string;
};

export type PassportProps = ClosedPassport | OpenPassport;

/** Presents distinct tracked objects as coverage, never as XP or a level. */
export function Passport(props: PassportProps) {
  if (props.kind === "open") {
    return (
      <section
        aria-label={`${props.count} ${props.unit} stamped`}
        {...stylex.props(styles.passport)}
      >
        <PassportCount count={props.count} detail={`${props.unit} stamped`} />
        {props.nextStampIn ? (
          <p {...stylex.props(styles.note)}>
            {formatSmallCount(props.nextStampIn)} more for the next stamp
          </p>
        ) : null}
      </section>
    );
  }

  const count = props.stamps.filter((stamp) => stamp.stamped).length;
  const total = props.stamps.length;
  const missing = props.stamps
    .filter((stamp) => !stamp.stamped)
    .map((stamp) => stamp.label);
  const percentage = Math.round((count / total) * 100);

  return (
    <section
      aria-label={`${count} of ${total} ${props.unit} stamped`}
      {...stylex.props(styles.passport)}
    >
      <PassportCount
        count={count}
        detail={`of ${total} ${props.unit} stamped`}
      />
      {total <= 24 ? (
        <div
          aria-label={`${count} of ${total} stamps collected`}
          role="img"
          {...stylex.props(styles.stamps)}
        >
          {props.stamps.map((stamp, index) => (
            <span
              data-stamped={stamp.stamped || undefined}
              key={`${stamp.label}-${index}`}
              title={stamp.label}
              {...stylex.props(styles.stamp, stamp.stamped && styles.stamped)}
            />
          ))}
        </div>
      ) : (
        <div {...stylex.props(styles.coverage)}>
          <span
            aria-label={`${percentage}% stamped`}
            role="img"
            {...stylex.props(styles.coverageTrack)}
          >
            <span {...stylex.props(styles.coverageFill(`${percentage}%`))} />
          </span>
          <span {...stylex.props(styles.percentage)}>{percentage}%</span>
        </div>
      )}
      {missing.length > 0 ? (
        <p {...stylex.props(styles.note)}>
          not yet stamped: {missing.join(", ")}
        </p>
      ) : null}
    </section>
  );
}

function PassportCount({ count, detail }: { count: number; detail: string }) {
  return (
    <div {...stylex.props(styles.countRow)}>
      <strong {...stylex.props(styles.count)}>
        {count.toLocaleString("en-US")}
      </strong>
      <span {...stylex.props(styles.countDetail)}>{detail}</span>
    </div>
  );
}

function formatSmallCount(count: number) {
  if (count === 1) return "one";
  if (count === 2) return "two";
  return count.toLocaleString("en-US");
}

const styles = stylex.create({
  passport: {
    boxSizing: "border-box",
    width: "100%",
    padding: 0,
    backgroundColor: "transparent",
    color: colors.ink,
  },
  countRow: {
    display: "flex",
    minWidth: 0,
    alignItems: "baseline",
    gap: "8px",
  },
  count: {
    flexShrink: 0,
    fontFamily: fonts.display,
    fontSize: "36px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 0.95,
  },
  countDetail: {
    minWidth: 0,
    overflow: "hidden",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.4,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  stamps: {
    display: "flex",
    gap: "2px",
    marginTop: "12px",
  },
  stamp: {
    height: "14px",
    minWidth: 0,
    flex: "1 1 0",
    borderRadius: "1px",
    backgroundColor: colors.passportEmpty,
  },
  stamped: {
    backgroundColor: colors.accent,
  },
  coverage: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "12px",
  },
  coverageTrack: {
    height: "8px",
    flex: 1,
    overflow: "hidden",
    borderRadius: "1px",
    backgroundColor: colors.surface,
  },
  coverageFill: (width: string) => ({
    display: "block",
    width,
    height: "100%",
    backgroundColor: colors.accent,
  }),
  percentage: {
    flexShrink: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "13px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.4,
  },
  note: {
    margin: 0,
    marginTop: "12px",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.5,
  },
});
