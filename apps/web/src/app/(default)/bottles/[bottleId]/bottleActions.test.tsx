import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BottleActions from "./bottleActions";

const useAuthMock = vi.hoisted(() => vi.fn());
const useORPCMock = vi.hoisted(() => vi.fn());
const mutateAsyncMock = vi.hoisted(() => vi.fn());
const routerReplaceMock = vi.hoisted(() => vi.fn());
const flashMock = vi.hoisted(() => vi.fn());

vi.mock("@peated/web/hooks/useAuth", () => ({
  default: useAuthMock,
}));
vi.mock("@peated/web/lib/orpc/context", () => ({
  useORPC: useORPCMock,
}));
vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn(() => ({
    isPending: false,
    mutateAsync: mutateAsyncMock,
  })),
}));
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: routerReplaceMock })),
}));
vi.mock("@peated/web/components/flash", () => ({
  useFlashMessages: vi.fn(() => ({ flash: flashMock })),
}));

describe("BottleActions", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ user: { admin: true, mod: true } });
    useORPCMock.mockReturnValue({
      bottles: {
        delete: {
          mutationOptions: () => ({}),
        },
      },
    });
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
    expect(html).toContain('href="/bottles/42/audit"');
    expect(html).toContain("Audit Bottle");
    expect(html).toContain("Delete Bottle");
    expect(html).not.toContain("Audit history");
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
    expect(html).not.toContain("Audit Bottle");
    expect(html).not.toContain("Delete Bottle");
    expect(html).not.toContain("Audit history");
  });

  it("hides deletion from moderators who are not admins", () => {
    useAuthMock.mockReturnValue({ user: { admin: false, mod: true } });

    const html = renderToStaticMarkup(<BottleActions bottle={{ id: 42 }} />);

    expect(html).toContain("Edit Bottle");
    expect(html).not.toContain("Delete Bottle");
  });
});
