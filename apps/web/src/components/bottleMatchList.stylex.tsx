import type { Bottle } from "@peated/server/types";
import {
  type BottleIdentitySource,
  getBottleIdentityProps,
} from "@peated/web/lib/bottleListItem";
import * as stylex from "@stylexjs/stylex";
import { ChevronRight } from "lucide-react";
import { colors, space } from "../styles/tokens.stylex";
import { BottleIdentityRow } from "./bottleIdentityRow.stylex";
import { linkedRowStyles } from "./linkedRow.stylex";

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
            linkedRowStyles.container,
            linkedRowStyles.onGround,
          )}
        >
          <span {...stylex.props(styles.identity)}>
            <BottleIdentityRow
              {...getBottleIdentityProps(bottle, { includeBottler: true })}
              imageUrl={bottle.imageUrl}
              layout="cell"
              variant="search"
              verticalPadding="sm"
            />
          </span>
          <ChevronRight
            aria-hidden="true"
            size={18}
            {...stylex.props(styles.chevron)}
          />
          <button
            aria-busy={pendingBottleId === bottle.id || undefined}
            aria-label={`Use this bottle: ${bottle.fullName}`}
            disabled={pendingBottleId !== null}
            onClick={() => onUse(bottle)}
            type="button"
            {...stylex.props(linkedRowStyles.primaryLink, styles.button)}
          />
        </li>
      ))}
    </ul>
  );
}

const styles = stylex.create({
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
    display: "flex",
    minWidth: 0,
    paddingRight: space.x2,
    alignItems: "center",
    gap: space.x2,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    ":last-child": { borderBottomWidth: 0 },
  },
  identity: { minWidth: 0, flex: 1 },
  chevron: { flexShrink: 0, color: colors.inkMuted },
  button: {
    position: "absolute",
    inset: 0,
    margin: 0,
    padding: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    cursor: { default: "pointer", ":disabled": "progress" },
  },
});
