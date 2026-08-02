import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import BottleExactMetadata, {
  type BottleExactMetadataSource,
} from "./bottleExactMetadata";

const exactBottle = {
  category: "single_malt",
  edition: "2025 Release",
  statedAge: 21,
  abv: 55.1,
  vintageYear: 2004,
  releaseYear: 2025,
  singleCask: true,
  caskStrength: true,
  caskFill: "1st_fill",
  caskType: "oloroso",
  caskSize: "hogshead",
} satisfies BottleExactMetadataSource;

describe("BottleExactMetadata", () => {
  it("renders leading context and exact fields as non-breaking items", () => {
    const html = renderToStaticMarkup(
      <BottleExactMetadata bottle={exactBottle} leadingContent="Lagavulin" />,
    );
    const text = html.replace(/<[^>]*>/g, "");

    expect(html).toContain("flex-wrap");
    expect(text).toBe(
      "Lagavulin·2025 Release·Single Malt·21 years·55.1% ABV·2004 vintage·Single cask·Cask strength·1st Fill Oloroso Hogshead cask",
    );
    expect(html.match(/class="inline-flex whitespace-nowrap"/g)).toHaveLength(
      9,
    );
  });

  it("renders leading content alongside an edition without duplicate keys", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const html = renderToStaticMarkup(
        <BottleExactMetadata
          bottle={{
            ...exactBottle,
            edition: "Distillers Edition",
            group: { statedAge: exactBottle.statedAge },
          }}
          leadingContent="Lagavulin"
          variant="summary"
        />,
      );
      const text = html.replace(/<[^>]*>/g, "");

      expect(text).toContain("Lagavulin");
      expect(text).toContain("Distillers Edition");
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("omits absent optional metadata without empty separators", () => {
    const html = renderToStaticMarkup(
      <BottleExactMetadata
        bottle={{
          category: null,
          edition: null,
          statedAge: null,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          singleCask: null,
          caskStrength: null,
          caskFill: null,
          caskType: null,
          caskSize: null,
        }}
      />,
    );

    expect(html).toBe("");
  });

  it("summarizes only the highest-value release identifiers", () => {
    const html = renderToStaticMarkup(
      <BottleExactMetadata
        bottle={{
          ...exactBottle,
          edition: "Batch 24",
          group: { statedAge: 21 },
        }}
        variant="summary"
      />,
    );
    const text = html.replace(/<[^>]*>/g, "");

    expect(html).toContain("block truncate");
    expect(html).not.toContain("flex-wrap");
    expect(text).toBe("Batch 24·55.1% ABV");
    expect(text).not.toContain("21 years");
    expect(text).not.toContain("Single cask");
    expect(text).not.toContain("Cask strength");
    expect(text).not.toContain("Single Malt");
  });

  it("uses ABV without promoting generic cask details", () => {
    const html = renderToStaticMarkup(
      <BottleExactMetadata
        bottle={{
          ...exactBottle,
          edition: null,
          statedAge: 4,
          vintageYear: null,
          releaseYear: null,
          caskType: "pedro_ximenez",
          caskSize: null,
          group: { statedAge: 4 },
        }}
        variant="summary"
      />,
    );
    const text = html.replace(/<[^>]*>/g, "");

    expect(text).toBe("55.1% ABV");
  });

  it("omits a release summary when the full Bottle name is already shown", () => {
    const html = renderToStaticMarkup(
      <BottleExactMetadata bottle={exactBottle} variant="summary" />,
    );

    expect(html).toBe("");
  });
});
