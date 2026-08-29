import { expect, test } from "vitest";
import issueText from "./issueText";

test("uses plain labels for preview errors", () => {
  const text = issueText("detail.name");

  expect(text).toBe("Item name: Peated could not read this part of the page.");
  expect(issueText("detail.reviewerName")).toBe(
    "Reviewer name: Peated could not read this part of the page.",
  );
  expect(text).not.toContain("detail.name");
});
