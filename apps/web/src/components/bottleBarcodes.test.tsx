import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { BottleBarcodeItems } from "./bottleBarcodes";

describe("BottleBarcodeItems", () => {
  test("shows barcode numbers and known package sizes", () => {
    const html = renderToStaticMarkup(
      <BottleBarcodeItems
        barcodes={[
          {
            value: "96385074",
            volume: 700,
          },
          {
            value: "4006381333931",
            volume: null,
          },
        ]}
      />,
    );

    expect(html).toContain("96385074");
    expect(html).toContain("700 mL package");
    expect(html).toContain("4006381333931");
    expect(html).not.toContain("Remove");
  });
});
