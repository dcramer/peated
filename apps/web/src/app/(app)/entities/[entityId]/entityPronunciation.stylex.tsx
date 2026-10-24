"use client";

import * as stylex from "@stylexjs/stylex";
import { Volume2 } from "lucide-react";

import {
  colors,
  controlMetrics,
  space,
} from "../../../../styles/tokens.stylex";

import type { Entity } from "./entityPageData";

const REDUCED_MOTION = "@media (prefers-reduced-motion: reduce)";

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
 * Shows how to say a brand or producer name: `glen GEER-ee`. Stressed
 * syllables are stored in capitals; they render lowercase with a CSS transform
 * so screen readers say the syllable instead of spelling out its letters. The
 * IPA (`/ɡlɛn ˈɡɪəri/`) is a tooltip on the respelling, and shows inline only
 * when there is no respelling. When Peated has audio for the IPA, a play
 * button reads it aloud.
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
        <span
          title={pronunciationIpa ? `/${pronunciationIpa}/` : undefined}
          {...stylex.props(
            styles.respelling,
            Boolean(pronunciationIpa) && styles.hasIpa,
          )}
        >
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
      ) : (
        <span lang="und-fonipa" {...stylex.props(styles.ipa)}>
          /{pronunciationIpa}/
        </span>
      )}
      {pronunciationIpa && pronunciationAudioUrl ? (
        // A bare icon instead of IconButton: it sits inside a line of text, so
        // a framed control would crowd the line. The hit area stays larger
        // than the icon.
        <button
          aria-label={`Play pronunciation of ${entity.name}`}
          onClick={() => playPronunciation(pronunciationAudioUrl)}
          type="button"
          {...stylex.props(styles.play)}
        >
          <Volume2 aria-hidden size="1.1em" />
        </button>
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
  // Hints that the respelling has a tooltip with the IPA.
  hasIpa: {
    cursor: "help",
    textDecorationLine: "underline",
    textDecorationStyle: "dotted",
    textDecorationColor: colors.inkMuted,
    textUnderlineOffset: "0.2em",
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
  play: {
    position: "relative",
    display: "inline-flex",
    verticalAlign: "-0.2em",
    marginInlineStart: space.x1,
    padding: 0,
    borderWidth: 0,
    borderRadius: controlMetrics.radius,
    backgroundColor: "transparent",
    color: {
      default: colors.inkMuted,
      ":hover": colors.ink,
      ":active": colors.accent,
      ":focus-visible": colors.ink,
    },
    cursor: "pointer",
    outline: { default: "none", ":focus-visible": "2px solid currentColor" },
    outlineOffset: "1px",
    transitionProperty: "color",
    transitionDuration: { default: "120ms", [REDUCED_MOTION]: "0ms" },
    // Widens the touch target without making the metadata line taller.
    "::after": {
      position: "absolute",
      inset: "-10px",
      content: '""',
    },
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
