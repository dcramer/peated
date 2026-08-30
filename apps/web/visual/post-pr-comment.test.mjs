import { describe, expect, it } from "vitest";

import { buildBody } from "./post-pr-comment.mjs";

describe("buildBody", () => {
  it("describes selected pages and changed files", () => {
    const body = buildBody(
      {
        changedFiles: ["apps/web/src/components/loginForm.tsx"],
        scenarioIds: ["login"],
        screenshots: [{ file: "login__desktop.png", label: "Login · desktop" }],
        selection: "changed-files",
        skipped: false,
      },
      "https://example.com/screenshots",
    );

    expect(body).toContain("## Web screenshots");
    expect(body).toContain("Run: pages matched to changed files");
    expect(body).toContain("Pages: `login`");
    expect(body).toContain("`apps/web/src/components/loginForm.tsx`");
    expect(body).toContain(
      "![Login · desktop](https://example.com/screenshots/login__desktop.png)",
    );
  });

  it("explains when no page matches", () => {
    const body = buildBody(
      {
        changedFiles: ["apps/web/e2e/activity-feed.spec.ts"],
        scenarioIds: [],
        screenshots: [],
        selection: "changed-files",
        skipped: true,
      },
      "https://example.com/screenshots",
    );

    expect(body).toContain(
      "No screenshot scenarios match these changed files.",
    );
  });
});
