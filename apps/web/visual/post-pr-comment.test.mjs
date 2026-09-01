import { describe, expect, it } from "vitest";

import {
  buildBody,
  frameshiftStatus,
  frameshiftViewerUrl,
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
  it("builds the native Frameshift status", () => {
    const viewerUrl = frameshiftViewerUrl(
      "dcramer/peated",
      "0123456789abcdef0123456789abcdef01234567",
    );

    expect(viewerUrl).toBe(
      "https://frameshift.pub/?ref=0123456789abcdef0123456789abcdef01234567&repo=dcramer%2Fpeated",
    );
    expect(frameshiftStatus(viewerUrl, 1)).toEqual({
      context: "Frameshift",
      description: "1 visual change",
      state: "success",
      target_url: viewerUrl,
    });
    expect(frameshiftStatus(viewerUrl, 2).description).toBe("2 visual changes");
  });

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
          image: "images/diff/login__desktop.png",
          images: {
            baseline: "images/baseline/login__desktop.png",
            candidate: "images/candidate/login__desktop.png",
            diff: "images/diff/login__desktop.png",
          },
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
      "https://frameshift.pub/?repo=dcramer%2Fpeated&ref=abc",
    );

    expect(shouldPostComment(candidate)).toBe(true);
    expect(body).toContain("## Web screenshots");
    expect(body).toContain(
      "[Open the full report in Frameshift](https://frameshift.pub/?repo=dcramer%2Fpeated&ref=abc)",
    );
    expect(body).toContain("Run: pages matched to changed files");
    expect(body).toContain("Pages: `login`");
    expect(body).toContain("`apps/web/src/components/loginForm.tsx`");
    expect(body).toContain("### Login · desktop — Changed");
    expect(body).toContain(
      "![Login · desktop before](https://example.com/screenshots/images/baseline/login__desktop.png)",
    );
    expect(body).toContain(
      "![Login · desktop after](https://example.com/screenshots/images/candidate/login__desktop.png)",
    );
    expect(body).toContain("<summary>Pixel diff</summary>");
    expect(body).toContain(
      "![Login · desktop pixel diff](https://example.com/screenshots/images/diff/login__desktop.png)",
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
      "https://frameshift.pub/?repo=dcramer%2Fpeated&ref=abc",
    );

    expect(body).toContain("No visual changes in the selected pages.");
    expect(body).not.toContain("https://example.com/screenshots/images");
  });

  it("shows only the available side for added and removed screenshots", () => {
    const body = buildBody(
      {
        baseline: manifest(),
        candidate: manifest(),
        report: {
          files: [
            {
              file: "added.png",
              image: "images/candidate/added.png",
              images: { candidate: "images/candidate/added.png" },
              status: "added",
            },
            {
              file: "removed.png",
              image: "images/baseline/removed.png",
              images: { baseline: "images/baseline/removed.png" },
              status: "removed",
            },
          ],
          summary: { added: 1, changed: 0, removed: 1, unchanged: 0 },
          version: 1,
        },
      },
      "https://example.com/screenshots",
      "https://frameshift.pub/?repo=dcramer%2Fpeated&ref=abc",
    );

    expect(body).toContain("### added.png — Added\n\n#### After");
    expect(body).toContain(
      "![added.png after](https://example.com/screenshots/images/candidate/added.png)",
    );
    expect(body).toContain("### removed.png — Removed\n\n#### Before");
    expect(body).toContain(
      "![removed.png before](https://example.com/screenshots/images/baseline/removed.png)",
    );
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
            images: {
              baseline: "images/baseline/login.png",
              candidate: "images/candidate/login.png",
              diff: "../login.png",
            },
            status: "changed",
          },
        ],
        version: 1,
      }),
    ).toThrow("Invalid report image path");
  });

  it("rejects incomplete image sets", () => {
    expect(() =>
      validateReport({
        files: [
          {
            file: "login.png",
            image: "images/candidate/login.png",
            images: { candidate: "images/candidate/login.png" },
            status: "changed",
          },
        ],
        version: 1,
      }),
    ).toThrow("Invalid visual diff images for changed");
  });

  it("keeps the version 1 image aligned with the pixel diff", () => {
    expect(() =>
      validateReport({
        files: [
          {
            file: "login.png",
            image: "images/candidate/login.png",
            images: {
              baseline: "images/baseline/login.png",
              candidate: "images/candidate/login.png",
              diff: "images/diff/login.png",
            },
            status: "changed",
          },
        ],
        version: 1,
      }),
    ).toThrow("Invalid visual diff image for changed");
  });
});
