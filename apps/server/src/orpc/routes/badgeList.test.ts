import { routerClient } from "../router";

describe("GET /badges", () => {
  test("lists badges", async ({ fixtures }) => {
    await fixtures.Badge();
    await fixtures.Badge();

    const { results } = await routerClient.badgeList();
    expect(results.length).toBe(2);
  });
});
