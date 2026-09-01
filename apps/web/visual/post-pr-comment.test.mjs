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

  it("links to Frameshift with a text summary", () => {
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
      "https://frameshift.pub/?repo=dcramer%2Fpeated&ref=abc",
    );

    expect(shouldPostComment(candidate)).toBe(true);
    expect(body).toContain("## Frameshift");
    expect(body).toContain(
      "**1 visual change** — 1 changed · 0 added · 0 removed",
    );
    expect(body).toContain(
      "[Review the visual report in Frameshift](https://frameshift.pub/?repo=dcramer%2Fpeated&ref=abc)",
    );
    expect(body).not.toContain("![");
    expect(body).not.toContain("apps/web/src/components/loginForm.tsx");
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
      "https://frameshift.pub/?repo=dcramer%2Fpeated&ref=abc",
    );

    expect(body).toContain("**No visual changes**");
  });

  it("summarizes added and removed screenshots", () => {
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
      "https://frameshift.pub/?repo=dcramer%2Fpeated&ref=abc",
    );

    expect(body).toContain(
      "**2 visual changes** — 0 changed · 1 added · 1 removed",
    );
    expect(body).not.toContain("added.png");
    expect(body).not.toContain("removed.png");
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
