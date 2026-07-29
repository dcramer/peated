import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import ModActions from "./modActions";

vi.mock("@peated/web/hooks/useAuth", () => ({
  default: () => ({ user: { mod: true } }),
}));

describe("ModActions", () => {
  it("keeps Bottle maintenance actions without the superseded prefill route", () => {
    const html = renderToStaticMarkup(<ModActions bottle={{ id: 42 }} />);

    expect(html).toContain('href="/bottles/42/aliases"');
    expect(html).toContain("View Aliases");
    expect(html).toContain('href="/bottles/42/edit"');
    expect(html).toContain("Edit Bottle");
    expect(html).toContain('href="/bottles/42/merge"');
    expect(html).toContain("Merge Bottle");
    expect(html).not.toContain("Add Similar Bottling");
    expect(html).not.toContain("/bottles/new?");
  });
});
