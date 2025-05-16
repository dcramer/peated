import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("POST /tags", () => {
  test("requires mod", async ({ fixtures }) => {
    const user = await fixtures.User();
    const err = await waitError(() =>
      routerClient.tags.create(
        {
          name: "Peated",
          tagCategory: "peaty",
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("creates tag", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const tag = await routerClient.tags.create(
      {
        name: "Peated",
        tagCategory: "peaty",
      },
      { context: { user } },
    );

    expect(tag.name).toEqual("peated");
    expect(tag.tagCategory).toEqual("peaty");
  });
});
