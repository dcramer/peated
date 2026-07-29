import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PreviewBottleCard } from "./previewBottleCard";

describe("PreviewBottleCard", () => {
  it("materializes the complete exact Bottle identity", () => {
    const html = renderToStaticMarkup(
      <PreviewBottleCard
        data={{
          name: "12-year-old Cask Strength",
          brand: { id: 1, name: "Springbank" },
          distillers: [{ id: 2, name: "J & A Mitchell" }],
          category: "single_malt",
          sharedStatedAge: 12,
          exactStatedAge: null,
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

    expect(html).toContain('aria-label="Bottle preview"');
    expect(html).toContain("Springbank 12-year-old Cask Strength");
    expect(html).toContain("Batch 24");
    expect(html).toContain("2025");
    expect(html).toContain("2013");
    expect(html).toContain("57.2%");
    expect(html).toContain("Single Cask");
    expect(html).toContain("Cask Strength");
    expect(html).toContain("Oloroso Cask");
    expect(html).toContain("Hogshead");
    expect(html).toContain("1st Fill");
    expect(html).toContain("Aged 12 years");
  });
});
