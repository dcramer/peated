import { describe, expect, test } from "vitest";

import { nextTaskAfterCompletion } from "./inboxPage";

const task = (key: string) => ({ key });

describe("nextTaskAfterCompletion", () => {
  test("opens the task that visibly followed the completed task", () => {
    expect(
      nextTaskAfterCompletion(
        [task("A"), task("B"), task("C")],
        [task("A"), task("C")],
        "B",
      ),
    ).toEqual(task("C"));
  });

  test("keeps the visible successor when the refreshed list is reordered", () => {
    expect(
      nextTaskAfterCompletion(
        [task("A"), task("B"), task("C")],
        [task("D"), task("A"), task("C")],
        "B",
      ),
    ).toEqual(task("C"));
  });

  test("uses the oldest remaining task when the visible successor is gone", () => {
    expect(
      nextTaskAfterCompletion(
        [task("A"), task("B"), task("C")],
        [task("D"), task("A")],
        "B",
      ),
    ).toEqual(task("D"));
  });

  test("wraps after completing the final task", () => {
    expect(
      nextTaskAfterCompletion(
        [task("A"), task("B"), task("C")],
        [task("A"), task("B")],
        "C",
      ),
    ).toEqual(task("A"));
  });

  test("returns to the Inbox when no tasks remain", () => {
    expect(nextTaskAfterCompletion([task("A")], [], "A")).toBeUndefined();
  });

  test("starts from the oldest task when the completed task was not listed", () => {
    expect(
      nextTaskAfterCompletion(
        [task("A"), task("B")],
        [task("A"), task("B")],
        "C",
      ),
    ).toEqual(task("A"));
  });
});
