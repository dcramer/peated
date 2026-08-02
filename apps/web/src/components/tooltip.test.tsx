import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Tooltip from "./tooltip";

describe("Tooltip", () => {
  it("centers a centered tooltip over its trigger", () => {
    const html = renderToStaticMarkup(
      <Tooltip title="Tooltip content" origin="center">
        <span>Trigger</span>
      </Tooltip>,
    );

    expect(html).toContain("z-10");
    expect(html).toContain("left-1/2 -translate-x-1/2");
  });

  it("allows a caller to style the tooltip panel", () => {
    const html = renderToStaticMarkup(
      <Tooltip title="Tooltip content" contentClassName="w-72 rounded-lg">
        <span>Trigger</span>
      </Tooltip>,
    );

    expect(html).toContain("w-72 rounded-lg");
    expect(html).not.toContain("w-48 max-w-48");
  });
});
