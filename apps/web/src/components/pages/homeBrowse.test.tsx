import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HomeDistilleries } from "./homeBrowse.stylex";

describe("HomeDistilleries", () => {
  it("shows locations without repeating the distillery kind", () => {
    const html = renderToStaticMarkup(
      <HomeDistilleries
        distilleries={[
          {
            href: "/distillers/42",
            kind: "distillery",
            location: "Islay, Scotland",
            name: "Example Distillery",
          },
        ]}
        totalDistilleries={1267}
      />,
    );

    expect(html).toContain("Islay, Scotland");
    expect(html).not.toContain("Distillery ·");
  });
});
