import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PeatedId from "./peatedId";

describe("PeatedId", () => {
  it("renders the labeled ID, permanent path, and copy action", () => {
    const html = renderToStaticMarkup(<PeatedId value="B000123" />);

    expect(html).toContain(">ID<");
    expect(html).toContain("B000123");
    expect(html).toContain('href="/B000123"');
    expect(html).toContain('aria-label="Copy B000123 link"');
  });
});
