import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { EntityPronunciation } from "./entityPronunciation.stylex";

function textOf(html: string) {
  return html.replace(/<[^>]+>/g, "");
}

describe("EntityPronunciation", () => {
  test("reads stressed syllables as words and marks IPA", () => {
    const html = renderToStaticMarkup(
      <EntityPronunciation
        entity={{
          pronunciation: "glen GEER-ee",
          pronunciationIpa: "ɡlɛn ˈɡɪəri",
        }}
      />,
    );

    expect(textOf(html)).toBe("Pronounced glen geer-ee /ɡlɛn ˈɡɪəri/");
    expect(html).toContain('lang="und-fonipa"');
  });

  test("shows IPA alone when there is no respelling", () => {
    const html = renderToStaticMarkup(
      <EntityPronunciation
        entity={{ pronunciation: null, pronunciationIpa: "ɡlɛn ˈɡɪəri" }}
      />,
    );

    expect(textOf(html)).toBe("Pronounced /ɡlɛn ˈɡɪəri/");
  });

  test("renders nothing without a pronunciation", () => {
    const html = renderToStaticMarkup(
      <EntityPronunciation
        entity={{ pronunciation: null, pronunciationIpa: null }}
      />,
    );

    expect(html).toBe("");
  });
});
