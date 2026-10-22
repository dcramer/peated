// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { EntityPronunciation } from "./entityPronunciation.stylex";

const AUDIO_URL =
  "https://api.example.com/uploads/entity-pronunciations/1-abc.mp3";
const OTHER_AUDIO_URL =
  "https://api.example.com/uploads/entity-pronunciations/2-def.mp3";

function textOf(html: string) {
  return html.replace(/<[^>]+>/g, "");
}

describe("EntityPronunciation", () => {
  test("reads stressed syllables as words and marks IPA", () => {
    const html = renderToStaticMarkup(
      <EntityPronunciation
        entity={{
          name: "Glen Garioch",
          pronunciation: "glen GEER-ee",
          pronunciationIpa: "ɡlɛn ˈɡɪəri",
          pronunciationAudioUrl: null,
        }}
      />,
    );

    expect(textOf(html)).toBe("Pronounced glen geer-ee /ɡlɛn ˈɡɪəri/");
    expect(html).toContain('lang="und-fonipa"');
  });

  test("reads a respelling without stress as written", () => {
    const html = renderToStaticMarkup(
      <EntityPronunciation
        entity={{
          name: "Mortlach",
          pronunciation: "mort-lack",
          pronunciationIpa: null,
          pronunciationAudioUrl: null,
        }}
      />,
    );

    expect(textOf(html)).toBe("Pronounced mort-lack");
  });

  test("shows IPA alone when there is no respelling", () => {
    const html = renderToStaticMarkup(
      <EntityPronunciation
        entity={{
          name: "Glen Garioch",
          pronunciation: null,
          pronunciationIpa: "ɡlɛn ˈɡɪəri",
          pronunciationAudioUrl: null,
        }}
      />,
    );

    expect(textOf(html)).toBe("Pronounced /ɡlɛn ˈɡɪəri/");
  });

  test("renders nothing without a pronunciation", () => {
    const html = renderToStaticMarkup(
      <EntityPronunciation
        entity={{
          name: "Glen Garioch",
          pronunciation: null,
          pronunciationIpa: null,
          pronunciationAudioUrl: null,
        }}
      />,
    );

    expect(html).toBe("");
  });

  test("offers a play button only when audio exists", () => {
    const entity = {
      name: "Glen Garioch",
      pronunciation: "glen GEER-ee",
      pronunciationIpa: "ɡlɛn ˈɡɪəri",
    };

    const withAudio = renderToStaticMarkup(
      <EntityPronunciation
        entity={{ ...entity, pronunciationAudioUrl: AUDIO_URL }}
      />,
    );
    const withoutAudio = renderToStaticMarkup(
      <EntityPronunciation
        entity={{ ...entity, pronunciationAudioUrl: null }}
      />,
    );

    expect(withAudio).toContain(
      'aria-label="Play pronunciation of Glen Garioch"',
    );
    expect(withoutAudio).not.toContain("<button");
  });

  test("plays the audio on press through one shared player", async () => {
    const played: HTMLMediaElement[] = [];
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(
      async function (this: HTMLMediaElement) {
        played.push(this);
      },
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      act(() =>
        root.render(
          <>
            <EntityPronunciation
              entity={{
                name: "Glen Garioch",
                pronunciation: null,
                pronunciationIpa: "ɡlɛn ˈɡɪəri",
                pronunciationAudioUrl: AUDIO_URL,
              }}
            />
            <EntityPronunciation
              entity={{
                name: "Mortlach",
                pronunciation: null,
                pronunciationIpa: "ˈmɔːtlax",
                pronunciationAudioUrl: OTHER_AUDIO_URL,
              }}
            />
          </>,
        ),
      );
      expect(played).toEqual([]);

      const [first, second] = container.querySelectorAll("button");
      await act(async () => first!.click());
      expect(played).toHaveLength(1);
      expect(played[0]!.src).toBe(AUDIO_URL);

      await act(async () => second!.click());
      expect(played).toHaveLength(2);
      expect(played[1]).toBe(played[0]);
      expect(played[1]!.src).toBe(OTHER_AUDIO_URL);
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
