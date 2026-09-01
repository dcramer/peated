import { describe, expect, test } from "vitest";

import { snapshotFile } from "../e2e/test";

const commonTest = {
  file: "/project/e2e/example.spec.ts",
  project: { name: "chromium-desktop", testDir: "/project/e2e" },
  title: "renders the state",
};

describe("snapshotFile", () => {
  test("keeps describe titles in the durable snapshot path", () => {
    const first = snapshotFile(
      {
        ...commonTest,
        titlePath: ["example.spec.ts", "first flow", "renders the state"],
      },
      "ready",
    );
    const second = snapshotFile(
      {
        ...commonTest,
        titlePath: ["example.spec.ts", "second flow", "renders the state"],
      },
      "ready",
    );

    expect(first).toBe(
      "example/first-flow/renders-the-state/ready__chromium-desktop.png",
    );
    expect(second).toBe(
      "example/second-flow/renders-the-state/ready__chromium-desktop.png",
    );
  });
});
