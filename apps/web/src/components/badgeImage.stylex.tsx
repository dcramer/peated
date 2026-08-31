"use client";

import type { Badge } from "@peated/server/types";
import * as stylex from "@stylexjs/stylex";

import { colors, controlMetrics } from "../styles/tokens.stylex";

export type BadgeImageProps = {
  badge: Badge;
  level?: number;
  size?: number;
};

function PlaceholderBadgeImage({
  isMaxLevel = false,
  size = 64,
}: {
  isMaxLevel?: boolean;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ height: size, width: size }}
      {...stylex.props(
        styles.placeholder,
        isMaxLevel && styles.maxLevelPlaceholder,
      )}
    />
  );
}

export function BadgeImage({ badge, level, size = 64 }: BadgeImageProps) {
  const isMaxLevel = level === badge.maxLevel;

  if (!badge.imageUrl) {
    return <PlaceholderBadgeImage isMaxLevel={isMaxLevel} size={size} />;
  }

  return (
    <span style={{ height: size, width: size }} {...stylex.props(styles.frame)}>
      <span {...stylex.props(styles.placeholderFrame)}>
        <PlaceholderBadgeImage isMaxLevel={isMaxLevel} size={size} />
      </span>
      <img
        alt=""
        height={size}
        onError={(event) => {
          event.currentTarget.hidden = true;
        }}
        src={badge.imageUrl}
        width={size}
        {...stylex.props(styles.image, isMaxLevel && styles.maxLevelImage)}
      />
    </span>
  );
}

const styles = stylex.create({
  frame: {
    position: "relative",
    display: "inline-block",
    flexShrink: 0,
  },
  placeholderFrame: {
    position: "absolute",
    inset: 0,
  },
  placeholder: {
    boxSizing: "border-box",
    display: "block",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.inset,
    boxShadow: `inset 0 0 0 2px ${colors.hairline}`,
  },
  maxLevelPlaceholder: {
    boxShadow: `inset 0 0 0 2px ${colors.accent}`,
  },
  image: {
    position: "relative",
    display: "block",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.imageBackground,
    objectFit: "contain",
    boxShadow: `inset 0 0 0 1px ${colors.hairline}`,
  },
  maxLevelImage: {
    boxShadow: `inset 0 0 0 1px ${colors.accent}`,
  },
});
