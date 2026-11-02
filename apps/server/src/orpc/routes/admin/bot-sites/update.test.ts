import { db } from "@peated/server/db";
import { botSites } from "@peated/server/db/schema";
import {
  getBotSiteSettings,
  recordBotWall,
} from "@peated/server/lib/peatedBot";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("PATCH /admin/bot-sites", () => {
  test("requires an administrator", async ({ fixtures }) => {
    const moderator = await fixtures.User({ mod: true });
    const error = await waitError(
      routerClient.admin.botSites.update(
        { origin: "https://shop.example", blocked: false },
        { context: { user: moderator } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("records a robots.txt exception that PeatedBot then follows", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });

    const result = await routerClient.admin.botSites.update(
      {
        origin: "https://shop.example/whisky/page?x=1",
        robotsException: { reason: "Owner allowed PeatedBot by email." },
      },
      { context: { user: admin } },
    );

    expect(result).toEqual({
      origin: "https://shop.example",
      blockedAt: null,
      robotsException: {
        reason: "Owner allowed PeatedBot by email.",
        createdAt: expect.any(String),
        createdBy: { id: admin.id, username: admin.username },
      },
    });
    expect(await getBotSiteSettings("https://shop.example")).toEqual({
      robotsException: true,
      blocked: false,
    });
  });

  test("clears a blocked mark and keeps the exception", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    await routerClient.admin.botSites.update(
      {
        origin: "https://shop.example",
        robotsException: { reason: "Agreed." },
      },
      { context: { user: admin } },
    );
    await recordBotWall("https://shop.example");

    const result = await routerClient.admin.botSites.update(
      { origin: "https://shop.example", blocked: false },
      { context: { user: admin } },
    );

    expect(result.blockedAt).toBeNull();
    expect(result.robotsException?.reason).toBe("Agreed.");
    expect(await getBotSiteSettings("https://shop.example")).toEqual({
      robotsException: true,
      blocked: false,
    });
  });

  test("removes the row once nothing is left on it", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    await recordBotWall("https://shop.example");

    const result = await routerClient.admin.botSites.update(
      { origin: "https://shop.example", blocked: false, robotsException: null },
      { context: { user: admin } },
    );

    expect(result).toEqual({
      origin: "https://shop.example",
      blockedAt: null,
      robotsException: null,
    });
    expect(
      await db
        .select()
        .from(botSites)
        .where(eq(botSites.origin, "https://shop.example")),
    ).toEqual([]);
  });

  test("rejects a request that changes nothing or isn't a web address", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });

    for (const input of [
      { origin: "https://shop.example" },
      { origin: "ftp://shop.example", blocked: false as const },
      { origin: "not a url", blocked: false as const },
      {
        origin: "https://shop.example",
        robotsException: { reason: "  " },
      },
    ]) {
      const error = await waitError(
        routerClient.admin.botSites.update(input, {
          context: { user: admin },
        }),
      );
      expect(error.message).toBe("Input validation failed");
    }
  });
});
