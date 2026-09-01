import { describe, expect, test } from "vitest";

import { snapshotFile, snapshotMetadataFile } from "../e2e/test";

const commonTest = {
  file: "/project/e2e/example.spec.ts",
  project: { name: "chromium-desktop", testDir: "/project/e2e" },
  title: "renders the state",
};

describe("snapshotFile", () => {
  test("uses only the title in the review path", () => {
    expect(snapshotFile("bottle")).toBe("bottle.png");
  });

  test("uses slash-separated titles as Frameshift categories", () => {
    expect(snapshotFile("Tasting form / Review / 1 Score")).toBe(
      "tasting-form/review/1-score.png",
    );
  });

  test("rejects empty category segments", () => {
    expect(() => snapshotFile("Tasting form / / Score")).toThrow(
      "Snapshot titles and category segments must contain a letter or number.",
    );
  });

  test("keeps test titles in hidden metadata paths", () => {
    const first = snapshotMetadataFile(
      {
        ...commonTest,
        titlePath: ["example.spec.ts", "first flow", "renders the state"],
      },
      "account/ready",
    );
    const second = snapshotMetadataFile(
      {
        ...commonTest,
        titlePath: ["example.spec.ts", "second flow", "renders the state"],
      },
      "account/ready",
    );

    expect(first).toBe(
      "example/first-flow/renders-the-state/account/ready__chromium-desktop.json",
    );
    expect(second).toBe(
      "example/second-flow/renders-the-state/account/ready__chromium-desktop.json",
    );
  });
});
