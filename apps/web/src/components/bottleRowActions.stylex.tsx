"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";

import type { BottleRowActionControls } from "@peated/web/hooks/useBottleRowActions";

import { space } from "../styles/tokens.stylex";
import type { BottleListItem } from "./bottleList.stylex";
import { RowMenu } from "./rowMenu.stylex";
import { BottleRatings, type BottleRatingsProps } from "./scoring.stylex";

const COMPACT = "@media (max-width: 639px)";

type Bottle = Outputs["bottles"]["list"]["results"][number];

export function addBottleRowActions({
  bottle,
  controls,
  item,
}: {
  bottle: Pick<Bottle, "id" | "isLibrary">;
  controls: BottleRowActionControls;
  item: BottleListItem;
}): BottleListItem {
  return {
    ...item,
    end: (
      <BottleRowActions
        bottle={bottle}
        controls={controls}
        label={item.name}
        ratings={item.ratings}
      />
    ),
    isLibrary: controls.isLibrary(bottle),
    ratings: undefined,
  };
}

export function BottleRowActions({
  controls,
  bottle,
  label,
  ratings,
}: {
  controls: BottleRowActionControls;
  bottle: Pick<Bottle, "id" | "isLibrary">;
  label: string;
  ratings?: BottleRatingsProps;
}) {
  return (
    <div {...stylex.props(styles.rowEnd)}>
      {ratings ? <BottleRatings {...ratings} /> : null}
      <span {...stylex.props(styles.desktopMenu)}>
        <RowMenu
          groups={controls.groupsFor(bottle)}
          label={label}
          triggerVariant="text"
        />
      </span>
    </div>
  );
}

const styles = stylex.create({
  rowEnd: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
  },
  desktopMenu: {
    display: "inline-flex",
    [COMPACT]: {
      display: "none",
    },
  },
});
