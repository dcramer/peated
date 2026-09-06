import type { Outputs } from "@peated/server/orpc/router";
import { getBottleIdentityProps } from "@peated/web/lib/bottleListItem";
import * as stylex from "@stylexjs/stylex";
import { foundationStyles } from "../styles/foundations.stylex";
import { colors, controlMetrics, space } from "../styles/tokens.stylex";
import { BottleIdentityRow } from "./bottleIdentityRow.stylex";
import { Button } from "./button.stylex";

export type BottleCreateCandidate =
  Outputs["bottles"]["createCandidates"]["results"][number];

export function BottleCreateCandidateSummary({
  count,
  loading = false,
  newSinceReview = false,
  onReview,
}: {
  count: number;
  loading?: boolean;
  newSinceReview?: boolean;
  onReview: () => void;
}) {
  const bottleCount = `${count} ${newSinceReview ? "more " : ""}${
    count === 1 ? "bottle" : "bottles"
  }`;
  return (
    <div aria-busy={loading || undefined} {...stylex.props(styles.summary)}>
      <p
        aria-live="polite"
        role="status"
        {...stylex.props(foundationStyles.metadata, styles.status)}
      >
        {bottleCount} may match this one.
      </p>
      <Button
        aria-label={`Review ${bottleCount} that may match this one`}
        disabled={loading}
        onClick={onReview}
        size="sm"
        type="button"
        variant="text"
      >
        Review
      </Button>
    </div>
  );
}

export function BottleCreateCandidates({
  error,
  loading,
  onUse,
  ready = true,
  results,
}: {
  error: boolean;
  loading: boolean;
  onUse: (bottle: BottleCreateCandidate) => void;
  ready?: boolean;
  results: readonly BottleCreateCandidate[];
}) {
  return (
    <section
      aria-busy={loading || undefined}
      aria-label="Bottles that may match"
      {...stylex.props(styles.root)}
    >
      {!ready ? (
        <p {...stylex.props(foundationStyles.metadata, styles.status)}>
          Choose a brand and enter a bottle name to check for matches.
        </p>
      ) : loading ? (
        <p
          role="status"
          {...stylex.props(foundationStyles.metadata, styles.status)}
        >
          Checking existing bottles…
        </p>
      ) : error ? (
        <p
          role="status"
          {...stylex.props(foundationStyles.metadata, styles.status)}
        >
          Couldn’t check existing bottles. You can still add this one.
        </p>
      ) : results.length ? (
        <>
          <p {...stylex.props(foundationStyles.body, styles.instructions)}>
            If one of these is the same bottle, use it instead of adding
            another.
          </p>
          <ul {...stylex.props(styles.list)}>
            {results.map((bottle) => (
              <li key={bottle.id} {...stylex.props(styles.row)}>
                <BottleIdentityRow
                  {...getBottleIdentityProps(bottle, { includeBottler: true })}
                  end={
                    <Button
                      aria-label={`Use this bottle: ${bottle.fullName}`}
                      onClick={() => onUse(bottle)}
                      size="sm"
                      type="button"
                      variant="tonal"
                    >
                      Use this bottle
                    </Button>
                  }
                  imageUrl={bottle.imageUrl}
                  layout="cell"
                  variant="search"
                  verticalPadding="sm"
                />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p
          role="status"
          {...stylex.props(foundationStyles.metadata, styles.status)}
        >
          No similar bottles found.
        </p>
      )}
    </section>
  );
}

const summaryEnter = stylex.keyframes({
  from: { opacity: 0, transform: "translateY(-8px)" },
  to: { opacity: 1, transform: "translateY(0)" },
});

const REDUCED_MOTION = "@media (prefers-reduced-motion: reduce)";

const styles = stylex.create({
  root: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x2,
  },
  summary: {
    display: "flex",
    minWidth: 0,
    minHeight: "44px",
    paddingRight: space.x2,
    paddingLeft: space.x3,
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x2,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.accentTint,
    animationName: { default: summaryEnter, [REDUCED_MOTION]: "none" },
    animationDuration: "200ms",
    animationTimingFunction: "ease-out",
  },
  instructions: { margin: 0, color: colors.inkMuted },
  status: { minHeight: "20px", margin: 0, color: colors.inkMuted },
  list: {
    display: "flex",
    minWidth: 0,
    margin: 0,
    padding: 0,
    flexDirection: "column",
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    listStyle: "none",
  },
  row: {
    minWidth: 0,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    ":last-child": { borderBottomWidth: 0 },
  },
});
