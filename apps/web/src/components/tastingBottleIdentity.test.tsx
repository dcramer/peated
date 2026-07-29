import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import TastingBottleIdentity, {
  type TastingBottleIdentitySource,
} from "./tastingBottleIdentity";

const bottle = {
  id: 42,
  fullName: "Lagavulin 21 Cask 42",
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
} satisfies TastingBottleIdentitySource;

describe("TastingBottleIdentity", () => {
  it("links the hydrated Bottle and renders its distinguishing fields", () => {
    const html = renderToStaticMarkup(
      <TastingBottleIdentity bottle={bottle} />,
    );
    const text = html.replace(/<[^>]*>/g, "");

    expect(html).toContain('href="/bottles/42"');
    expect(text).toContain("Lagavulin 21 Cask 42");
    expect(text).toContain("Single Malt·21 years·55.1% ABV");
    expect(text).toContain("2004 vintage·2025 release");
    expect(text).toContain("Single cask·Cask strength");
    expect(text).toContain("1st Fill Oloroso Hogshead cask");
  });
});
