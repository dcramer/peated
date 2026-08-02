import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PreviewBottleCard } from "./previewBottleCard";

describe("PreviewBottleCard", () => {
  it("renders a concise identity with release details as metadata", () => {
    const html = renderToStaticMarkup(
      <PreviewBottleCard
        data={{
          name: "12-year-old",
          brand: { id: 1, name: "Springbank" },
          series: { id: 3, name: "Local Barley" },
          distillers: [{ id: 2, name: "J & A Mitchell" }],
          category: "single_malt",
          statedAge: 12,
          edition: "Batch 24",
          releaseYear: 2025,
          vintageYear: 2013,
          abv: 57.2,
          singleCask: true,
          caskStrength: true,
          caskFill: "1st_fill",
          caskType: "oloroso",
          caskSize: "hogshead",
        }}
      />,
    );
    const text = html.replace(/<[^>]*>/g, "");

    expect(html).toContain('aria-label="Bottle preview"');
    expect(html).toContain("Springbank");
    expect(html).toContain("Local Barley");
    expect(html).toContain("12-year-old");
    expect(html).toContain("Batch 24");
    expect(text).toContain("Batch 24·57.2% ABV");
    expect(html).not.toContain("12 years");
    expect(html).not.toContain("2025");
    expect(html).not.toContain("2013");
    expect(html).toContain("57.2% ABV");
    expect(html).not.toContain("Single Cask");
    expect(html).not.toContain("Cask strength");
    expect(html).not.toContain("1st Fill Oloroso Hogshead cask");
    expect(html).toContain("uppercase");
    expect(html).toContain("bg-highlight");
    expect(html).toContain("text-black/70");
    expect(html).not.toContain("Single Malt");
    expect(html).not.toContain("Distilled at");
    expect(html).not.toContain("border-slate-800");
  });
});
