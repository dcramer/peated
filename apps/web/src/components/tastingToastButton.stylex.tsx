"use client";

import * as stylex from "@stylexjs/stylex";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";
import { foundationStyles } from "../styles/foundations.stylex";
import { colors, space } from "../styles/tokens.stylex";
import { Button, ButtonLink } from "./button.stylex";

/** Owns the member-specific toast action and count for one tasting. */
export function TastingToastSummary({
  authorId,
  hasToasted = false,
  initialCount,
  tastingId,
}: {
  authorId?: number;
  hasToasted?: boolean;
  initialCount: number;
  tastingId: number;
}) {
  const { user } = useAuth();
  const orpc = useORPC();
  const createToast = useMutation(orpc.toasts.create.mutationOptions());
  const [toasted, setToasted] = useState(hasToasted);
  const [count, setCount] = useState(initialCount);
  const canToast = Boolean(
    user && authorId !== undefined && user.id !== authorId,
  );

  function toast() {
    if (!canToast || toasted || createToast.isPending) return;

    createToast.mutate(
      { tasting: tastingId },
      {
        onSuccess: () => {
          setToasted(true);
          setCount((value) => value + 1);
        },
      },
    );
  }

  return (
    <div {...stylex.props(styles.summary)}>
      {!user ? (
        <ButtonLink href="/login" size="sm" variant="tonal">
          Toast
        </ButtonLink>
      ) : canToast ? (
        <Button
          disabled={toasted}
          loading={createToast.isPending}
          onClick={toast}
          size="sm"
          variant="tonal"
        >
          {toasted ? "Toasted" : "Toast"}
        </Button>
      ) : null}
      <span {...stylex.props(foundationStyles.metadata, styles.count)}>
        {formatToastCount(count, toasted)}
      </span>
      {createToast.error ? (
        <span
          aria-live="polite"
          {...stylex.props(foundationStyles.metadata, styles.error)}
        >
          We couldn't save your toast. Try again.
        </span>
      ) : null}
    </div>
  );
}

function formatToastCount(count: number, hasToasted: boolean) {
  if (hasToasted && count > 1)
    return `You and ${count - 1} others toasted this`;
  if (hasToasted) return "You toasted this";
  return `${count.toLocaleString("en-US")} ${count === 1 ? "person" : "people"} toasted this`;
}

const styles = stylex.create({
  summary: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    alignItems: "center",
    gap: space.x3,
  },
  count: {
    minWidth: 0,
    overflow: "hidden",
    color: colors.inkMuted,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  error: {
    flexShrink: 0,
    color: colors.critical,
  },
});
