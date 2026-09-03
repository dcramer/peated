import { ORPCError } from "@orpc/client";
// @vitest-environment jsdom
import type { ExternalReviewScoringPolicy } from "@peated/server/schemas";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ReviewScoringForm } from "./reviewScoringForm.stylex";

const policy: ExternalReviewScoringPolicy = {
  enabled: true,
  rules: [
    {
      scale: 10,
      guideUrl: "https://example.com/guide",
      explanation: "Example test guide",
      from: null,
      until: null,
      points: [
        { source: 0, target: 0 },
        { source: 10, target: 100 },
      ],
    },
  ],
};
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const button = (text: string) =>
  [...container.querySelectorAll("button")].find(
    (item) => item.textContent === text,
  );

test("requires a fresh preview after every edit and saves its version", async () => {
  const onPreview = vi.fn().mockResolvedValue({
    version: 3,
    totalBottles: 0,
    samples: [],
    bottles: [],
  });
  const onSave = vi.fn().mockResolvedValue(undefined);
  act(() =>
    root.render(
      <ReviewScoringForm
        settings={{ version: 1, policy, recomputePending: false }}
        onPreview={onPreview}
        onSave={onSave}
      />,
    ),
  );
  expect(button("Save score settings")).toBeUndefined();
  await act(async () => button("Preview changes")!.click());
  expect(button("Save score settings")).toBeDefined();
  const select = container.querySelector("select")!;
  act(() => {
    select.value = "exclude";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(button("Save score settings")).toBeUndefined();
  await act(async () => button("Preview changes")!.click());
  await act(async () => button("Save score settings")!.click());
  expect(onSave).toHaveBeenCalledWith({ ...policy, enabled: false }, 3);
});

test("requires another preview after a conflicting save", async () => {
  const onPreview = vi.fn().mockResolvedValue({
    version: 1,
    totalBottles: 0,
    samples: [],
    bottles: [],
  });
  const onSave = vi.fn().mockRejectedValue(
    new ORPCError("CONFLICT", {
      defined: true,
      message: "Scoring settings changed. Preview your changes again.",
    }),
  );
  act(() =>
    root.render(
      <ReviewScoringForm
        settings={{ version: 1, policy, recomputePending: false }}
        onPreview={onPreview}
        onSave={onSave}
      />,
    ),
  );
  await act(async () => button("Preview changes")!.click());
  await act(async () => button("Save score settings")!.click());
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Preview your changes again",
  );
  expect(button("Save score settings")).toBeUndefined();
});
