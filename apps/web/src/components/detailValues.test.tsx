import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SpecStrip } from "./dataDevices.stylex";
import { FactList } from "./factList.stylex";

describe("detail values", () => {
  it("omits facts without values and keeps zero", () => {
    const html = renderToStaticMarkup(
      <FactList
        facts={[
          { label: "Also known as", value: null },
          { label: "Website", value: "" },
          { label: "Bottles", value: 0 },
        ]}
      />,
    );

    expect(html).not.toContain("Also known as");
    expect(html).not.toContain("Website");
    expect(html).toContain("Bottles");
    expect(html).toContain(">0<");
  });

  it("does not render a fact list when every value is missing", () => {
    expect(
      renderToStaticMarkup(
        <FactList facts={[{ label: "Also known as", value: null }]} />,
      ),
    ).toBe("");
  });

  it("omits empty specs and keeps zero", () => {
    const html = renderToStaticMarkup(
      <SpecStrip
        cells={[
          { label: "Founded", value: null },
          { label: "Country", value: "" },
          { label: "Bottles", value: 0 },
        ]}
      />,
    );

    expect(html).not.toContain("Founded");
    expect(html).not.toContain("Country");
    expect(html).toContain("Bottles");
    expect(html).toContain(">0<");
  });
});
