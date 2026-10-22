import type { Outputs } from "@peated/server/orpc/router";
import type { Bottle } from "@peated/server/types";
import {
  type BottleIdentitySource,
  getBottleIdentityProps,
} from "@peated/web/lib/bottleListItem";
import * as stylex from "@stylexjs/stylex";
import { ChevronRight } from "lucide-react";
import { foundationStyles } from "../styles/foundations.stylex";
import { colors, controlMetrics, space } from "../styles/tokens.stylex";
import { BottleIdentityRow } from "./bottleIdentityRow.stylex";
import { Button } from "./button.stylex";
import { linkedRowStyles } from "./linkedRow.stylex";

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
          <BottleMatchList bottles={results} onUse={onUse} />
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

type BottleMatchListItem = BottleIdentitySource &
  Pick<Bottle, "id" | "fullName" | "imageUrl">;

/**
 * Bottles a member may pick instead. The whole row is one button; the shared
 * linked-row styles own its hover, press, and focus states (DESIGN.md).
 */
export function BottleMatchList<TBottle extends BottleMatchListItem>({
  bottles,
  onUse,
  pendingBottleId = null,
}: {
  bottles: readonly TBottle[];
  onUse: (bottle: TBottle) => void;
  pendingBottleId?: number | null;
}) {
  return (
    <ul {...stylex.props(styles.list)}>
      {bottles.map((bottle) => (
        <li
          key={bottle.id}
          {...stylex.props(
            styles.row,
            styles.matchRow,
            linkedRowStyles.container,
            linkedRowStyles.onGround,
          )}
        >
          <span {...stylex.props(styles.rowIdentity)}>
            <BottleIdentityRow
              {...getBottleIdentityProps(bottle, { includeBottler: true })}
              imageUrl={bottle.imageUrl}
              layout="cell"
              variant="search"
              verticalPadding="sm"
            />
          </span>
          {pendingBottleId === bottle.id ? (
            <span {...stylex.props(foundationStyles.metadata, styles.status)}>
              Opening…
            </span>
          ) : (
            <ChevronRight
              aria-hidden="true"
              size={18}
              {...stylex.props(styles.chevron)}
            />
          )}
          <button
            aria-busy={pendingBottleId === bottle.id || undefined}
            aria-label={`Use this bottle: ${bottle.fullName}`}
            disabled={pendingBottleId !== null}
            onClick={() => onUse(bottle)}
            type="button"
            {...stylex.props(linkedRowStyles.primaryLink, styles.rowButton)}
          />
        </li>
      ))}
    </ul>
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
  rowButton: {
    position: "absolute",
    inset: 0,
    margin: 0,
    padding: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    cursor: { default: "pointer", ":disabled": "progress" },
  },
  chevron: { flexShrink: 0, color: colors.inkMuted },
  rowIdentity: { minWidth: 0, flex: 1 },
  matchRow: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
    paddingRight: space.x2,
  },
  row: {
    minWidth: 0,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    ":last-child": { borderBottomWidth: 0 },
  },
});
