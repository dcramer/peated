import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Button from "./button";

describe("Button", () => {
  it("merges custom classes with its default styling", () => {
    const html = renderToStaticMarkup(
      <Button className="custom-marker">Save</Button>,
    );

    expect(html).toContain("inline-flex");
    expect(html).toContain("custom-marker");
  });

  it("supports intentionally custom-styled buttons", () => {
    const html = renderToStaticMarkup(
      <Button unstyled className="custom-marker">
        Save
      </Button>,
    );

    expect(html).toContain('class="custom-marker"');
    expect(html).not.toContain("bg-slate-900");
  });
});
