import { db } from "@peated/server/db";
import { entityReferences } from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("GET /smws/distillers", () => {
  test("lists distilleries by canonical name or alias", async ({
    fixtures,
  }) => {
    const cascadeHollow = await fixtures.Entity({
      name: "Cascade Hollow",
      kind: "distillery",
    });
    await db
      .delete(entityReferences)
      .where(eq(entityReferences.entityId, cascadeHollow.id));

    const theGlenlivet = await fixtures.Entity({
      name: "The Glenlivet",
      kind: "distillery",
    });
    await fixtures.EntityReference({
      entityId: theGlenlivet.id,
      name: "Glenlivet",
    });

    const inchDairnie = await fixtures.Entity({
      name: "InchDairnie Distillery",
      kind: "distillery",
    });

    await fixtures.Entity({ name: "Bowmore", kind: "company" });
    await fixtures.Entity({
      name: "Not an SMWS distillery",
      kind: "distillery",
    });

    const user = await fixtures.User({ mod: true });
    const { results } = await routerClient.smws.distillerList(
      {},
      { context: { user } },
    );

    expect(new Set(results.map((result) => result.id))).toEqual(
      new Set([cascadeHollow.id, theGlenlivet.id, inchDairnie.id]),
    );
    expect(
      results.find((result) => result.id === cascadeHollow.id)?.smwsCodes,
    ).toContain("B5");
    expect(
      results.find((result) => result.id === theGlenlivet.id)?.smwsCodes,
    ).toContain("2");
    expect(
      results.find((result) => result.id === inchDairnie.id)?.smwsCodes,
    ).toEqual(["168", "169"]);
  });
});
