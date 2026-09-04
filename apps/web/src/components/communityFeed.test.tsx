// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CommunityFeed, type CommunityFeedItem } from "./communityFeed.stylex";

describe("CommunityFeed", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("links the full activity card while keeping author and bottle links independent", () => {
    const item: CommunityFeedItem = {
      id: "tasting-1",
      kind: "tasting",
      actor: "alice",
      actorHref: "/users/alice",
      action: "tasted",
      date: "2026-09-04T12:00:00.000Z",
      href: "/tastings/1-example-bottle",
      bottles: [
        {
          id: "1",
          name: "Example Bottle",
          href: "/bottles/1-example-bottle",
        },
      ],
    };

    act(() => root.render(<CommunityFeed items={[item]} />));

    const links = [...container.querySelectorAll("a")];
    expect(links).toHaveLength(3);
    expect(
      links
        .find(
          (link) =>
            link.getAttribute("aria-label") ===
            "View tasting of Example Bottle by alice",
        )
        ?.getAttribute("href"),
    ).toBe("/tastings/1-example-bottle");
    expect(
      links
        .find((link) => link.textContent === "Example Bottle")
        ?.getAttribute("href"),
    ).toBe("/bottles/1-example-bottle");
    expect(
      links.find((link) => link.textContent === "alice")?.getAttribute("href"),
    ).toBe("/users/alice");
    expect(container.textContent).not.toContain("View tasting");
  });

  it("uses one collection link for collection activity", () => {
    const item: CommunityFeedItem = {
      id: "collection-1",
      kind: "collection_add",
      actor: "alice",
      action: "added 2 bottles to",
      date: "2026-09-04T12:00:00.000Z",
      href: "/users/alice/library",
      destination: {
        href: "/users/alice/library",
        label: "their library",
      },
      bottles: [
        { id: "1", name: "First Bottle", href: "/bottles/1-first" },
        { id: "2", name: "Second Bottle", href: "/bottles/2-second" },
      ],
    };

    act(() => root.render(<CommunityFeed items={[item]} />));

    const links = [...container.querySelectorAll("a")];
    expect(links).toHaveLength(3);
    expect(
      links.filter(
        (link) => link.getAttribute("href") === "/users/alice/library",
      ),
    ).toHaveLength(1);
    expect(links.map((link) => link.textContent)).toEqual([
      "their library",
      "First Bottle",
      "Second Bottle",
    ]);
  });
});
