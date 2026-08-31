import { describe, expect, it } from "vitest";

import { buildBody, shouldPostComment } from "./post-pr-comment.mjs";

describe("post PR comment", () => {
  it("describes selected pages and changed files", () => {
    const manifest = {
      changedFiles: ["apps/web/src/components/loginForm.tsx"],
      scenarioIds: ["login"],
      screenshots: [{ file: "login__desktop.png", label: "Login · desktop" }],
      selection: "changed-files",
      skipped: false,
    };
    const body = buildBody(manifest, "https://example.com/screenshots");

    expect(shouldPostComment(manifest)).toBe(true);
    expect(body).toContain("## Web screenshots");
    expect(body).toContain("Run: pages matched to changed files");
    expect(body).toContain("Pages: `login`");
    expect(body).toContain("`apps/web/src/components/loginForm.tsx`");
    expect(body).toContain(
      "![Login · desktop](https://example.com/screenshots/login__desktop.png)",
    );
  });

  it("skips the comment when no page matches", () => {
    expect(
      shouldPostComment({
        changedFiles: ["apps/web/e2e/activity-feed.spec.ts"],
        scenarioIds: [],
        screenshots: [],
        selection: "changed-files",
        skipped: true,
      }),
    ).toBe(false);
  });
});
