import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import BottleExactMetadata, {
  type BottleExactMetadataSource,
} from "./bottleExactMetadata";

const exactBottle = {
  category: "single_malt",
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

    expect(text).toBe(
      "Lagavulin·Single Malt·21 years·55.1% ABV·2004 vintage·2025 release·Single cask·Cask strength·1st Fill Oloroso Hogshead cask",
    );
    expect(html.match(/class="inline-flex whitespace-nowrap"/g)).toHaveLength(
      9,
    );
  });

  it("omits absent optional metadata without empty separators", () => {
    const html = renderToStaticMarkup(
      <BottleExactMetadata
        bottle={{
          category: null,
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
});
