import { createRouterClient } from "@orpc/server";
import waitError from "@peated/server/lib/test/waitError";
import {
  createSearchProcedure,
  type SearchSourceClient,
} from "@peated/server/orpc/routes/search";
import { expect, test, vi } from "vitest";

const bottleListMock = vi.fn<SearchSourceClient["searchBottles"]>();
const sources: SearchSourceClient = {
  searchBottles: bottleListMock,
  searchEntities: vi.fn(),
  searchUsers: vi.fn(),
};

const searchClient = createRouterClient(
  { search: createSearchProcedure(sources) },
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
