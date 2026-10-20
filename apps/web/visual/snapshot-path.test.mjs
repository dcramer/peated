import { describe, expect, test } from "vitest";

import { snapshotFile } from "../e2e/test";

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
});
