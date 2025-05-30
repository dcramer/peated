import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("POST /external-sites", () => {
  test("requires admin", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      routerClient.externalSites.create(
        {
          name: "Whisky Advocate",
          type: "whiskyadvocate",
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("triggers job", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });

    const newSite = await routerClient.externalSites.create(
      {
        name: "Whisky Advocate",
        type: "whiskyadvocate",
      },
      { context: { user } },
    );

    expect(newSite.name).toEqual("Whisky Advocate");
    expect(newSite.type).toEqual("whiskyadvocate");
    expect(newSite.runEvery).toBeNull();
  });
});
