import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BottleActions from "./bottleActions";

const useAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@peated/web/hooks/useAuth", () => ({
  default: useAuthMock,
}));

describe("BottleActions", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ user: { mod: true } });
  });

  it("puts the similar Bottle action before moderator maintenance actions", () => {
    const html = renderToStaticMarkup(<BottleActions bottle={{ id: 42 }} />);

    expect(html).toContain('aria-label="More bottle actions"');
    expect(html).toContain('href="/bottles/42/addRelease"');
    expect(html).toContain("Add a similar bottle");
    expect(html).toContain('href="/bottles/42/aliases"');
    expect(html).toContain("View Aliases");
    expect(html).toContain('href="/bottles/42/edit"');
    expect(html).toContain("Edit Bottle");
    expect(html).toContain('href="/bottles/42/merge"');
    expect(html).toContain("Merge Bottle");
    expect(html).not.toContain("Add Similar Bottling");
    expect(html).not.toContain("/bottles/new?");
  });

  it("shows the similar Bottle action to non-moderators", () => {
    useAuthMock.mockReturnValue({ user: null });

    const html = renderToStaticMarkup(<BottleActions bottle={{ id: 42 }} />);

    expect(html).toContain('href="/bottles/42/addRelease"');
    expect(html).toContain("Add a similar bottle");
    expect(html).not.toContain("View Aliases");
    expect(html).not.toContain("Edit Bottle");
    expect(html).not.toContain("Merge Bottle");
  });
});
