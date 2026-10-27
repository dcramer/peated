// @vitest-environment jsdom

import { createORPCClient, ORPCError } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { Outputs, Router } from "@peated/server/orpc/router";
import { BottleSchema } from "@peated/server/schemas/bottles";
import { ExternalReviewSchema } from "@peated/server/schemas/externalReviews";
import { ORPCContext } from "@peated/web/lib/orpc/context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  activityReview,
  existingBottle,
} from "../../../../e2e/rpc-fixtures.mjs";
import {
  findButton,
  findByLabel,
  mountDialog,
  typeInto,
} from "../../dialogTestHarness";
import ReviewTask, { reviewAssignment } from "./reviewTask";

describe("reviewAssignment", () => {
  const item = {
    review: { id: 18876, name: "Glenfarclas 1979/2014", bottle: null },
    attemptedAt: "2026-10-16T18:45:00.000Z",
  } satisfies Parameters<typeof reviewAssignment>[0];
  test("carries the observed review version without accepting a reusable name", () => {
    expect(reviewAssignment(item, 42)).toEqual({
      externalReview: 18876,
      bottle: 42,
      expectedResolution: {
        name: item.review.name,
        attemptedAt: item.attemptedAt,
      },
    });
  });
  test("does not assign a review before its first unresolved attempt completes", () => {
    expect(() => reviewAssignment({ ...item, attemptedAt: null }, 42)).toThrow(
      "no longer waiting",
    );
  });
});

describe("ReviewTask assignment errors", () => {
  let mounted: ReturnType<typeof mountDialog> | undefined;
  let queryClient: QueryClient | undefined;

  afterEach(() => {
    mounted?.unmount();
    queryClient?.clear();
    vi.useRealTimers();
  });

  async function renderTask(failure: Error | string) {
    vi.useFakeTimers();
    const bottle = BottleSchema.parse(existingBottle);
    const item = {
      review: ExternalReviewSchema.parse({
        ...activityReview,
        site: {
          ...activityReview.site,
          lastRunAt: null,
          nextRunAt: null,
          runEvery: null,
        },
        extractedTags: [],
        bottle: null,
      }),
      attemptedAt: "2026-10-16T18:45:00.000Z",
      check: null,
    } satisfies Outputs["externalReviews"]["resolution"];
    const task = {
      key: `external_review:${item.review.id}`,
      kind: "external_review",
      category: "listing",
      state: "ready",
      inconclusive: true,
      title: item.review.name,
      sourceLabel: "Whisky Advocate",
      question: "Which bottle should this review use?",
      statusLabel: "Unresolved review",
      attentionAt: item.attemptedAt,
      source: { kind: "external_review", reviewId: item.review.id },
    } satisfies Outputs["admin"]["moderation"]["listTasks"]["results"][number];
    const update = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValue({ ...item.review, bottle });
    const pageAction = vi.fn().mockRejectedValue(failure);
    const candidateSearch = vi.fn();
    const client = createORPCClient<RouterClient<Router>>({
      async call(path, input) {
        switch (path.join("/")) {
          case "externalReviews/resolution":
            return item;
          case "bottles/createCandidates":
            candidateSearch(input);
            return {
              results: [
                {
                  ...bottle,
                  comparison: { agreements: [], missing: [], conflicts: [] },
                },
              ],
              rel: { nextCursor: null, prevCursor: null },
            };
          case "bottles/list":
            return {
              results: [bottle],
              rel: { nextCursor: null, prevCursor: null },
            };
          case "externalReviews/update":
            return update(input);
          case "externalReviews/recheck":
          case "admin/content/moderate":
            return pageAction(input);
          default:
            throw new Error(`Unexpected RPC: ${path.join("/")}`);
        }
      },
    });
    const orpc = createTanstackQueryUtils(client);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
        mutations: { retry: false },
      },
    });
    queryClient.setQueryData(
      orpc.externalReviews.resolution.queryKey({
        input: { externalReview: item.review.id },
      }),
      item,
    );
    mounted = mountDialog();
    const onComplete = vi.fn(async () => undefined);
    await act(async () =>
      mounted!.root.render(
        <ORPCContext.Provider value={orpc}>
          <QueryClientProvider client={queryClient!}>
            <ReviewTask task={task} onComplete={onComplete} />
          </QueryClientProvider>
        </ORPCContext.Provider>,
      ),
    );
    return { bottle, candidateSearch, item, onComplete, update, pageAction };
  }

  test.for([
    [
      new ORPCError("CONFLICT", {
        message: "A review changed. Refresh before assigning a bottle.",
      }),
      "A review changed. Refresh before assigning a bottle.",
    ],
    ["unknown failure", "Unable to assign this bottle. Try again."],
  ] as const)(
    "shows assignment errors inside the dialog and permits retry",
    async ([failure, message]) => {
      const { bottle, onComplete, update } = await renderTask(failure);
      await act(async () => findButton("Choose a bottle").click());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) throw new Error("Bottle picker did not open");
      const choice = Array.from(dialog.querySelectorAll("button")).find(
        (button) => button.textContent?.includes(bottle.name),
      );
      if (!choice) throw new Error("Bottle choice is missing");
      await act(async () => choice.click());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });
      expect(dialog.querySelector('[role="alert"]')?.textContent).toBe(message);
      expect(choice.disabled).toBe(false);
      const close = dialog.querySelector<HTMLButtonElement>(
        'button[aria-label="Close"]',
      );
      expect(close?.disabled).toBe(false);
      expect(onComplete).not.toHaveBeenCalled();
      await act(async () => choice.click());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });
      expect(update).toHaveBeenCalledTimes(2);
      expect(onComplete).toHaveBeenCalledWith("Review assigned.");
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    },
  );

  test("a failed assignment still permits closing the dialog", async () => {
    const { bottle, onComplete } = await renderTask(
      new Error("Review changed"),
    );
    await act(async () => findButton("Choose a bottle").click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    const dialog = document.querySelector('[role="dialog"]');
    const choice = Array.from(dialog?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent?.includes(bottle.name),
    );
    if (!choice) throw new Error("Bottle choice is missing");
    await act(async () => choice.click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    const close = dialog?.querySelector<HTMLButtonElement>(
      'button[aria-label="Close"]',
    );
    if (!close) throw new Error("Close button is missing");
    await act(async () => close.click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
  });

  test("a review with no saved decision offers catalog candidates for its name", async () => {
    const { bottle, candidateSearch, item, onComplete, update } =
      await renderTask("unknown failure");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(candidateSearch).toHaveBeenCalledWith({
      name: item.review.name,
      limit: 5,
    });
    expect(document.body.textContent).toContain(
      "No matching decision was saved for this review.",
    );
    const choice = document.querySelector<HTMLButtonElement>(
      `button[aria-label="Use this bottle: ${bottle.fullName}"]`,
    );
    if (!choice) throw new Error("Candidate bottle is missing");
    await act(async () => choice.click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(document.body.textContent).toContain(
      "The decision could not be saved. Try again.",
    );
    expect(onComplete).not.toHaveBeenCalled();
    await act(async () => choice.click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(update).toHaveBeenLastCalledWith(reviewAssignment(item, bottle.id));
    expect(onComplete).toHaveBeenCalledWith("Review assigned.");
  });

  test.for(["recheck", "remove"] as const)(
    "%s errors remain visible on the page",
    async (action) => {
      const { pageAction, onComplete } = await renderTask(
        new Error("Queue unavailable"),
      );
      if (action === "remove") {
        await act(async () => findButton("Remove review").click());
        typeInto(findByLabel<HTMLTextAreaElement>("Reason"), "Not a review.");
        await act(async () => findButton("Remove review").click());
      } else {
        await act(async () => findButton("Check match again").click());
      }
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });
      expect(pageAction).toHaveBeenCalledTimes(1);
      expect(document.body.textContent).toContain("Queue unavailable");
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(onComplete).not.toHaveBeenCalled();
    },
  );
});
