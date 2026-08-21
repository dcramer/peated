import { createRouterClient } from "@orpc/server";
import waitError from "@peated/server/lib/test/waitError";
import search from "@peated/server/orpc/routes/search";
import { expect, test, vi } from "vitest";

const bottleListMock = vi.hoisted(() => vi.fn());

vi.mock("@peated/server/orpc/router", () => ({
  routerClient: {
    bottles: { list: bottleListMock },
    entities: { list: vi.fn() },
    users: { list: vi.fn() },
  },
}));

const searchClient = createRouterClient(
  { search },
  { context: { user: null } },
);

test("global search propagates an available source failure", async () => {
  const sourceError = new Error("Bottle search unavailable");
  bottleListMock.mockRejectedValueOnce(sourceError);

  const error = await waitError(() =>
    searchClient.search({
      query: "failure fixture",
      include: ["bottles"],
    }),
  );

  expect(error).toBe(sourceError);
});
