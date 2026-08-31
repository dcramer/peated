import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import {
  colors,
  controlMetrics,
  fonts,
  space,
} from "../../styles/tokens.stylex";

type IconSize = "sm" | "lg";

function ExternalSiteIcon({
  imageUrl,
  name,
  size,
}: {
  imageUrl: string | null;
  name: string;
  size: IconSize;
}) {
  const dimension = size === "sm" ? 26 : 48;
  const sizeStyle = size === "sm" ? styles.small : styles.large;
  return imageUrl ? (
    <img
      alt=""
      height={dimension}
      src={imageUrl}
      width={dimension}
      {...stylex.props(styles.icon, styles.image, sizeStyle)}
    />
  ) : (
    <span
      aria-hidden="true"
      {...stylex.props(styles.icon, styles.fallback, sizeStyle)}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export function ExternalSiteIdentity({
  children,
  imageUrl,
  name,
  size,
}: {
  children?: ReactNode;
  imageUrl: string | null;
  name: string;
  size: IconSize;
}) {
  return (
    <span {...stylex.props(styles.identity)}>
      <ExternalSiteIcon imageUrl={imageUrl} name={name} size={size} />
      <span>{children ?? name}</span>
    </span>
  );
}

const styles = stylex.create({
  icon: {
    display: "inline-flex",
    boxSizing: "border-box",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.imageBackground,
  },
  image: { objectFit: "contain" },
  fallback: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontWeight: 700,
    lineHeight: 1,
  },
  small: { width: "26px", height: "26px", fontSize: "10px" },
  large: { width: "48px", height: "48px", fontSize: "16px" },
  identity: {
    display: "inline-flex",
    minWidth: 0,
    alignItems: "center",
    gap: space.x2,
  },
});
