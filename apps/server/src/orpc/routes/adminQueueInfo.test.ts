import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/worker/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { routerClient } from "../router";

// Mock the getQueue function
vi.mock("@peated/server/worker/client", () => ({
  getQueue: vi.fn(),
}));

describe("GET /admin/queue/info", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Mock implementation of getQueue
    vi.mocked(workerClient.getQueue).mockResolvedValue({
      getJobCounts: vi.fn().mockResolvedValue({
        wait: 5,
        active: 10,
        completed: 100,
        failed: 2,
      }),
    } as any);
  });

  test("requires authentication", async () => {
    const err = await waitError(() => routerClient.adminQueueInfo({}));
    expect(err).toMatchInlineSnapshot(`
      [ORPCError: UNAUTHORIZED: Authentication required]
    `);
  });

  test("requires admin privileges", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      routerClient.adminQueueInfo({}, { context: { user } }),
    );
    expect(err).toMatchInlineSnapshot(`
      [ORPCError: FORBIDDEN: Admin privileges required]
    `);
  });

  test("returns queue stats", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });

    const result = await routerClient.adminQueueInfo({}, { context: { user } });

    expect(result).toEqual({
      stats: {
        wait: 5,
        active: 10,
        completed: 100,
        failed: 2,
      },
    });

    expect(workerClient.getQueue).toHaveBeenCalledWith("default");
  });
});
