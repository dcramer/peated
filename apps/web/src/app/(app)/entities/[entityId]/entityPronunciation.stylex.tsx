import * as stylex from "@stylexjs/stylex";

import { colors } from "../../../../styles/tokens.stylex";

import type { Entity } from "./entityPageData";

/**
 * Shows how to say a brand or producer name, like a dictionary entry:
 * `glen GEER-ee /ɡlɛn ˈɡɪəri/`. Stressed syllables are stored in capitals;
 * they render lowercase with a CSS transform so screen readers say the
 * syllable instead of spelling out its letters.
 */
export function EntityPronunciation({
  entity,
}: {
  entity: Pick<Entity, "pronunciation" | "pronunciationIpa">;
}) {
  const { pronunciation, pronunciationIpa } = entity;
  if (!pronunciation && !pronunciationIpa) return null;

  return (
    <span {...stylex.props(styles.root)}>
      <span {...stylex.props(styles.visuallyHidden)}>Pronounced </span>
      {pronunciation ? (
        <span {...stylex.props(styles.respelling)}>
          {pronunciation.split(/([ -])/).map((part, index) =>
            /[A-Z]/.test(part) ? (
              <span key={index} {...stylex.props(styles.stressed)}>
                {part.toLowerCase()}
              </span>
            ) : (
              part
            ),
          )}
        </span>
      ) : null}
      {pronunciation && pronunciationIpa ? " " : null}
      {pronunciationIpa ? (
        <span lang="und-fonipa" {...stylex.props(styles.ipa)}>
          /{pronunciationIpa}/
        </span>
      ) : null}
    </span>
  );
}

const styles = stylex.create({
  root: {
    overflowWrap: "anywhere",
  },
  respelling: {
    color: colors.ink,
  },
  stressed: {
    fontWeight: 600,
    textTransform: "uppercase",
  },
  // Karla has no IPA symbols. Use one system face for the whole value so a
  // word is not drawn half in Karla and half in a fallback font.
  ipa: {
    fontFamily: "system-ui, sans-serif",
  },
  visuallyHidden: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
  },
});
