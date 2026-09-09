import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { BottleList } from "@peated/web/components/bottleList.stylex";
import { BottleVisual } from "@peated/web/components/bottleVisual.stylex";
import { LoadingList } from "@peated/web/components/feedback.stylex";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import { colors, controlMetrics, space } from "../../styles/tokens.stylex";

const NARROW = "@media (max-width: 759px)";

type Bottle = Outputs["tastings"]["details"]["bottle"];

export type TastingReviewBottleSummaryProps = {
  bottle: Bottle;
  photoUrl?: string | null;
  placement: "desktop" | "mobile";
};

function TastingReviewBottleSummaryLayout({
  bottle,
  image,
  placement,
}: {
  bottle: ReactNode;
  image?: ReactNode;
  placement: "desktop" | "mobile";
}) {
  return (
    <div
      {...stylex.props(
        styles.media,
        placement === "desktop" ? styles.desktop : styles.mobile,
      )}
    >
      {image ? <figure {...stylex.props(styles.photo)}>{image}</figure> : null}
      {bottle}
    </div>
  );
}

/** Uses the tasting or review photo when present; otherwise uses the Bottle image. */
export function TastingReviewBottleSummary({
  bottle,
  photoUrl,
  placement,
}: TastingReviewBottleSummaryProps) {
  const bottleName = formatBottleDisplayName(bottle);
  const imageUrl = photoUrl ?? bottle.imageUrl;

  return (
    <TastingReviewBottleSummaryLayout
      bottle={
        <BottleList
          ariaLabel="Bottle"
          items={[{ ...toBottleListItem(bottle), variant: "sidebar" }]}
        />
      }
      image={
        imageUrl ? (
          <BottleVisual
            expandable
            imageUrl={imageUrl}
            label={`${bottleName} image`}
            size="xl"
          />
        ) : undefined
      }
      placement={placement}
    />
  );
}

/** Reserves the image and Bottle row used by tasting and review pages. */
export function TastingReviewBottleSummaryLoading({
  placement,
}: {
  placement: "desktop" | "mobile";
}) {
  return (
    <TastingReviewBottleSummaryLayout
      bottle={<LoadingList label="Loading bottle" rows={1} variant="sidebar" />}
      image={<span {...stylex.props(styles.loadingPhoto)} />}
      placement={placement}
    />
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
    aspectRatio: "4 / 5",
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.surface,
  },
});
