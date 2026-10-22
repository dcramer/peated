"use client";

import * as stylex from "@stylexjs/stylex";
import { Volume2 } from "lucide-react";

import { IconButton } from "../../../../components/button.stylex";
import { colors, space } from "../../../../styles/tokens.stylex";

import type { Entity } from "./entityPageData";

// One player for the page, so a second press restarts the sound instead of
// overlapping it. It is created on the first press; nothing plays on load.
let player: HTMLAudioElement | null = null;

function playPronunciation(audioUrl: string) {
  player ??= new Audio();
  if (player.src !== audioUrl) player.src = audioUrl;
  player.currentTime = 0;
  player.play().catch((error) => {
    // A newer press interrupted this one; that press plays instead.
    if (error instanceof DOMException && error.name === "AbortError") return;
    throw error;
  });
}

/**
 * Shows how to say a brand or producer name, like a dictionary entry:
 * `glen GEER-ee /ɡlɛn ˈɡɪəri/`. Stressed syllables are stored in capitals;
 * they render lowercase with a CSS transform so screen readers say the
 * syllable instead of spelling out its letters. When Peated has audio for the
 * IPA, a play button reads it aloud.
 */
export function EntityPronunciation({
  entity,
}: {
  entity: Pick<
    Entity,
    "name" | "pronunciation" | "pronunciationIpa" | "pronunciationAudioUrl"
  >;
}) {
  const { pronunciation, pronunciationIpa, pronunciationAudioUrl } = entity;
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
      {pronunciationIpa && pronunciationAudioUrl ? (
        <span {...stylex.props(styles.play)}>
          <IconButton
            icon={<Volume2 aria-hidden size={14} />}
            label={`Play pronunciation of ${entity.name}`}
            onClick={() => playPronunciation(pronunciationAudioUrl)}
            size="sm"
            variant="text"
          />
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
  // The button keeps its full touch target without making the metadata line
  // taller.
  play: {
    display: "inline-flex",
    verticalAlign: "middle",
    marginBlock: "-12px",
    marginInlineStart: space.x1,
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
