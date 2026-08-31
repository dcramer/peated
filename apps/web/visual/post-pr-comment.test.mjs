import { describe, expect, it } from "vitest";

import {
  buildBody,
  shouldPostComment,
  validateReport,
} from "./post-pr-comment.mjs";

function manifest(overrides = {}) {
  return {
    changedFiles: ["apps/web/src/components/loginForm.tsx"],
    scenarioIds: ["login"],
    screenshots: [{ file: "login__desktop.png", label: "Login · desktop" }],
    selection: "changed-files",
    skipped: false,
    ...overrides,
  };
}

describe("post PR comment", () => {
  it("shows only changed screenshots", () => {
    const candidate = manifest({
      screenshots: [
        { file: "login__desktop.png", label: "Login · desktop" },
        { file: "login__mobile.png", label: "Login · mobile" },
      ],
    });
    const report = {
      files: [
        {
          file: "login__desktop.png",
          image: "images/login__desktop.png",
          status: "changed",
        },
        { file: "login__mobile.png", status: "unchanged" },
      ],
      summary: { added: 0, changed: 1, removed: 0, unchanged: 1 },
      version: 1,
    };

    const body = buildBody(
      { baseline: manifest(), candidate, report },
      "https://example.com/screenshots",
    );

    expect(shouldPostComment(candidate)).toBe(true);
    expect(body).toContain("## Web screenshots");
    expect(body).toContain("Run: pages matched to changed files");
    expect(body).toContain("Pages: `login`");
    expect(body).toContain("`apps/web/src/components/loginForm.tsx`");
    expect(body).toContain("### Login · desktop — Changed");
    expect(body).toContain(
      "![Login · desktop changed](https://example.com/screenshots/images/login__desktop.png)",
    );
    expect(body).not.toContain("Login · mobile");
  });

  it("reports when selected pages have no visual changes", () => {
    const candidate = manifest();
    const body = buildBody(
      {
        baseline: manifest(),
        candidate,
        report: {
          files: [{ file: "login__desktop.png", status: "unchanged" }],
          summary: { added: 0, changed: 0, removed: 0, unchanged: 1 },
          version: 1,
        },
      },
      "https://example.com/screenshots",
    );

    expect(body).toContain("No visual changes in the selected pages.");
    expect(body).not.toContain("https://example.com/screenshots/images");
  });

  it("skips the comment when no page matches", () => {
    expect(
      shouldPostComment(
        manifest({ scenarioIds: [], screenshots: [], skipped: true }),
      ),
    ).toBe(false);
  });

  it("rejects report paths outside the report directory", () => {
    expect(() =>
      validateReport({
        files: [
          {
            file: "login.png",
            image: "../login.png",
            status: "changed",
          },
        ],
        version: 1,
      }),
    ).toThrow("Invalid report image path");
  });
});
