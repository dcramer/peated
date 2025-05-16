import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /badges/:id", () => {
  test("get badge by id", async ({ fixtures }) => {
    const badge = await fixtures.Badge();

    const data = await routerClient.badges.details({ id: badge.id });
    expect(data.id).toEqual(badge.id);
  });

  test("errors on invalid badge", async () => {
    const err = await waitError(routerClient.badges.details({ id: 1 }));
    expect(err).toMatchInlineSnapshot(`[Error: Badge not found.]`);
  });
});
