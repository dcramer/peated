import { routerClient } from "@peated/server/orpc/router";

describe("GET /badges", () => {
  test("lists badges", async ({ fixtures }) => {
    await fixtures.Badge();
    await fixtures.Badge();

    const { results } = await routerClient.badges.list();
    expect(results.length).toBe(2);
  });
});
