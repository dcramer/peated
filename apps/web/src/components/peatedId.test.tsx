import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PeatedId from "./peatedId";

describe("PeatedId", () => {
  it("renders the labeled ID, permanent path, and copy action", () => {
    const html = renderToStaticMarkup(<PeatedId value="B0123" />);

    expect(html).toContain(">ID<");
    expect(html).toContain("B0123");
    expect(html).toContain('href="/B0123"');
    expect(html).toContain('aria-label="Copy B0123 link"');
  });
});
