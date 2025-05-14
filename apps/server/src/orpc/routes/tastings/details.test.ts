import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /tastings/:id", () => {
  test("get tasting by id", async ({ fixtures }) => {
    const tasting = await fixtures.Tasting();

    const data = await routerClient.tastings.details({
      id: tasting.id,
    });
    expect(data.id).toEqual(tasting.id);
  });

  test("errors on invalid tasting", async () => {
    const err = await waitError(
      routerClient.tastings.details({
        id: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Tasting not found.]`);
  });
});
