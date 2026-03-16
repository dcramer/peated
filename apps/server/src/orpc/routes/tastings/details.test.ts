import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /tastings/:tasting", () => {
  test("get tasting by id", async ({ fixtures }) => {
    const tasting = await fixtures.Tasting();

    const data = await routerClient.tastings.details({
      tasting: tasting.id,
    });
    expect(data.id).toEqual(tasting.id);
  });

  test("returns exact bottle details when present", async ({ fixtures }) => {
    const tasting = await fixtures.Tasting({
      bottleDetails: {
        edition: "Batch 24",
        caskNumber: "117",
        bottleNumber: "142/246",
      },
    });

    const data = await routerClient.tastings.details({
      tasting: tasting.id,
    });

    expect(data.bottleDetails).toEqual({
      edition: "Batch 24",
      caskNumber: "117",
      bottleNumber: "142/246",
    });
  });

  test("errors on invalid tasting", async () => {
    const err = await waitError(
      routerClient.tastings.details({
        tasting: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Tasting not found.]`);
  });
});
