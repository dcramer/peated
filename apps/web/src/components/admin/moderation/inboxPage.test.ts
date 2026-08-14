import { describe, expect, test } from "vitest";

import { nextTaskAfterCompletion } from "./inboxPage";

describe("nextTaskAfterCompletion", () => {
  test("keeps moving forward after completing a task in the middle", () => {
    expect(nextTaskAfterCompletion(["A", "C"], 1)).toBe("C");
  });

  test("does not wrap after completing the final task", () => {
    expect(nextTaskAfterCompletion(["A", "B"], 2)).toBeUndefined();
  });

  test("starts from the oldest task when the completed task was not listed", () => {
    expect(nextTaskAfterCompletion(["A", "B"], -1)).toBe("A");
  });
});
