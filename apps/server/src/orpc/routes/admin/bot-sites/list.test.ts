import { db } from "@peated/server/db";
import { botSites } from "@peated/server/db/schema";
import { recordBotWall } from "@peated/server/lib/peatedBot";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /admin/bot-sites", () => {
  test("requires an administrator", async ({ defaults }) => {
    const error = await waitError(
      routerClient.admin.botSites.list(
        {},
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("lists blocked websites and robots.txt exceptions", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    await recordBotWall("https://walled.example");
    await routerClient.admin.botSites.update(
      { origin: "https://allowed.example", robotsException: { reason: "Ok." } },
      { context: { user: admin } },
    );
    // A row with nothing set is not shown.
    await db.insert(botSites).values({ origin: "https://plain.example" });

    const { results } = await routerClient.admin.botSites.list(
      {},
      { context: { user: admin } },
    );

    expect(results).toEqual([
      {
        origin: "https://allowed.example",
        blockedAt: null,
        robotsException: {
          reason: "Ok.",
          createdAt: expect.any(String),
          createdBy: { id: admin.id, username: admin.username },
        },
      },
      {
        origin: "https://walled.example",
        blockedAt: expect.any(String),
        robotsException: null,
      },
    ]);
  });
});
