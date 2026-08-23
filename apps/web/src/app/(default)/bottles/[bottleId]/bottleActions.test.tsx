import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BottleActionMenu } from "./bottleActions";

describe("BottleActions", () => {
  it("puts the similar Bottle action before moderator maintenance actions", () => {
    const html = renderToStaticMarkup(
      <BottleActionMenu
        bottle={{ id: 42 }}
        user={{ admin: true, mod: true }}
      />,
    );

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
    const html = renderToStaticMarkup(
      <BottleActionMenu bottle={{ id: 42 }} user={null} />,
    );

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
    const html = renderToStaticMarkup(
      <BottleActionMenu
        bottle={{ id: 42 }}
        user={{ admin: false, mod: true }}
      />,
    );

    expect(html).toContain("Edit Bottle");
    expect(html).not.toContain("Delete Bottle");
  });
});
