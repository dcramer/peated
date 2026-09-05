import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";

import { BottleList, BottleVisual, LoadingList } from "@peated/web/components";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import { colors, controlMetrics, space } from "../../styles/tokens.stylex";

const NARROW = "@media (max-width: 759px)";

type Bottle = Outputs["tastings"]["details"]["bottle"];

export type TastingReviewBottleSummaryProps = {
  bottle: Bottle;
  photoUrl?: string | null;
  placement: "desktop" | "mobile";
};

/** Uses the tasting or review photo when present; otherwise uses the Bottle image. */
export function TastingReviewBottleSummary({
  bottle,
  photoUrl,
  placement,
}: TastingReviewBottleSummaryProps) {
  const bottleName = formatBottleDisplayName(bottle);
  const imageUrl = photoUrl ?? bottle.imageUrl;

  return (
    <div
      {...stylex.props(
        styles.media,
        placement === "desktop" ? styles.desktop : styles.mobile,
      )}
    >
      {imageUrl ? (
        <figure {...stylex.props(styles.photo)}>
          <BottleVisual
            expandable
            imageUrl={imageUrl}
            label={`${bottleName} image`}
            size="xl"
          />
        </figure>
      ) : null}

      <BottleList
        ariaLabel="Bottle"
        items={[{ ...toBottleListItem(bottle), variant: "sidebar" }]}
      />
    </div>
  );
}

/** Reserves the image and Bottle row used by tasting and review pages. */
export function TastingReviewBottleSummaryLoading({
  placement,
}: {
  placement: "desktop" | "mobile";
}) {
  return (
    <div
      {...stylex.props(
        styles.media,
        placement === "desktop" ? styles.desktop : styles.mobile,
      )}
    >
      <span {...stylex.props(styles.loadingPhoto)} />
      <LoadingList label="Loading bottle" rows={1} variant="sidebar" />
    </div>
  );
}

const styles = stylex.create({
  media: {
    minWidth: 0,
  },
  desktop: {
    display: {
      default: "block",
      [NARROW]: "none",
    },
  },
  mobile: {
    display: {
      default: "none",
      [NARROW]: "block",
    },
    marginTop: space.x6,
    marginBottom: space.x2,
  },
  photo: {
    width: "100%",
    maxWidth: {
      default: "100%",
      [NARROW]: "440px",
    },
    marginTop: 0,
    marginRight: "auto",
    marginBottom: 0,
    marginLeft: "auto",
  },
  loadingPhoto: {
    display: "block",
    width: "100%",
    maxWidth: {
      default: "100%",
      [NARROW]: "440px",
    },
    aspectRatio: "4 / 5",
    marginRight: "auto",
    marginLeft: "auto",
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.surface,
  },
});
