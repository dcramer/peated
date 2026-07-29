import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BottleStatusIcons, { BottleStatusIndicators } from "./bottleStatusIcons";

describe("BottleStatusIndicators", () => {
  it("renders Bottle tasting and Library state", () => {
    const markup = renderToStaticMarkup(
      <BottleStatusIndicators hasTasted isLibrary />,
    );

    expect(markup).toContain('aria-label="Tasted"');
    expect(markup).toContain('aria-label="In Library"');
  });

  it("renders status from a Bottle projection", () => {
    const markup = renderToStaticMarkup(
      <BottleStatusIcons
        bottle={{ hasTasted: true, isLibrary: true }}
        hideLibrary
      />,
    );

    expect(markup).toContain('aria-label="Tasted"');
    expect(markup).not.toContain('aria-label="In Library"');
  });
});
