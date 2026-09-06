import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { BottleIdentityRow } from "./bottleIdentityRow.stylex";

describe("BottleIdentityRow", () => {
  test("renders provenance details as a native tooltip", () => {
    const html = renderToStaticMarkup(
      <BottleIdentityRow
        name="Blended whisky"
        provenance={[
          {
            name: "4 distilleries",
            title: "Caol Ila · Highland Park · Springbank · Talisker",
          },
        ]}
      />,
    );

    expect(html).toContain(
      'title="Caol Ila · Highland Park · Springbank · Talisker"',
    );
    expect(html).toContain(">4 distilleries</span>");
  });
});
