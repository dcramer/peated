import * as stylex from "@stylexjs/stylex";

import { colors, fonts } from "../styles/tokens.stylex";

export type ImageAttributionProps = {
  sourceUrl?: string | null;
  license?: string | null;
};

/** Keeps the image source and license separate from its caption. */
export function ImageAttribution({
  sourceUrl,
  license,
}: ImageAttributionProps) {
  if (!sourceUrl && !license) return null;

  return (
    <span {...stylex.props(styles.root)}>
      {sourceUrl ? (
        <a href={sourceUrl} rel="noreferrer" {...stylex.props(styles.link)}>
          Image source
        </a>
      ) : null}
      {sourceUrl && license ? <span aria-hidden="true"> · </span> : null}
      {license ? <span>{license}</span> : null}
    </span>
  );
}

const styles = stylex.create({
  root: {
    color: colors.inkMuted,
    display: "block",
    fontFamily: fonts.data,
    fontSize: "12px",
    lineHeight: 1.4,
    overflowWrap: "anywhere",
  },
  link: {
    color: {
      default: colors.inkMuted,
      ":hover": colors.accentDeep,
    },
    textDecorationLine: "underline",
    textDecorationThickness: "1px",
    textUnderlineOffset: "2px",
  },
});
