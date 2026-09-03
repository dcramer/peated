import * as stylex from "@stylexjs/stylex";

import { foundationStyles } from "../styles/foundations.stylex";
import { colors } from "../styles/tokens.stylex";

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
    <span {...stylex.props(foundationStyles.metadata, styles.root)}>
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
