import * as stylex from "@stylexjs/stylex";

import { colors, fonts } from "../styles/tokens.stylex";

export type AvatarSize = "xs" | "sm" | "md";

export type AvatarProps = {
  imageUrl?: string | null;
  initials: string;
  size?: AvatarSize;
};

/** Shows a member picture or the same initials fallback at each supported size. */
export function Avatar({ imageUrl, initials, size = "md" }: AvatarProps) {
  const sizeStyle =
    size === "xs" ? styles.extraSmall : size === "sm" ? styles.small : null;

  return imageUrl ? (
    <img
      alt=""
      src={imageUrl}
      {...stylex.props(styles.avatar, styles.image, sizeStyle)}
    />
  ) : (
    <span
      aria-hidden="true"
      {...stylex.props(styles.avatar, styles.fallback, sizeStyle)}
    >
      {initials}
    </span>
  );
}

const styles = stylex.create({
  avatar: {
    display: "inline-flex",
    width: "38px",
    height: "38px",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
  },
  image: {
    objectFit: "cover",
  },
  fallback: {
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1,
  },
  small: {
    width: "32px",
    height: "32px",
    fontSize: "11px",
  },
  extraSmall: {
    width: "26px",
    height: "26px",
    fontSize: "10px",
  },
});
