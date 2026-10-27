import { db } from "@peated/server/db";
import { botSites } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  createRedisBotCache,
  getBotSiteSettings,
  recordBotWall,
} from "./peatedBot";

describe("website settings", () => {
  test("a website without a row follows robots.txt and reads direct", async () => {
    await expect(getBotSiteSettings("https://new.example")).resolves.toEqual({
      robotsException: false,
      blocked: false,
    });
  });

  test("a bot wall marks the website blocked and keeps the first time", async () => {
    await recordBotWall("https://shop.example");
    const [first] = await db
      .select()
      .from(botSites)
      .where(eq(botSites.origin, "https://shop.example"));
    await recordBotWall("https://shop.example");
    const [second] = await db
      .select()
      .from(botSites)
      .where(eq(botSites.origin, "https://shop.example"));

    expect(second?.blockedAt).toEqual(first?.blockedAt);
    await expect(getBotSiteSettings("https://shop.example")).resolves.toEqual({
      robotsException: false,
      blocked: true,
    });
  });

  test("an admin's robots.txt exception is reported, and needs a reason and author", async ({
    defaults,
  }) => {
    await db.insert(botSites).values({
      origin: "https://allowed.example",
      robotsExceptionReason: "Blocks every bot; owner approved by email.",
      robotsExceptionById: defaults.user.id,
      robotsExceptionAt: new Date(),
    });

    await expect(
      getBotSiteSettings("https://allowed.example"),
    ).resolves.toEqual({ robotsException: true, blocked: false });
    await expect(
      db.insert(botSites).values({
        origin: "https://unexplained.example",
        robotsExceptionReason: "No author or time.",
      }),
    ).rejects.toThrow();
  });
});

describe("Redis cache", () => {
  test("stores and reads a value", async () => {
    const cache = createRedisBotCache();
    const key = `peatedbot:test:${randomUUID()}`;

    await cache.set(key, "rules", 60_000);

    await expect(cache.get(key)).resolves.toBe("rules");
  });

  test("acts like a miss when Redis does not answer in time", async () => {
    const cache = createRedisBotCache({
      connect: () => new Promise(() => {}),
      timeoutMs: 20,
    });

    await expect(cache.get("peatedbot:robots:x")).resolves.toBeNull();
    await expect(
      cache.set("peatedbot:robots:x", "rules", 1_000),
    ).resolves.toBeUndefined();
  });

  test("acts like a miss when Redis fails", async () => {
    const failing = async () => {
      throw new Error("Connection is closed.");
    };
    const cache = createRedisBotCache({
      connect: async () => ({ get: failing, set: failing }),
    });

    await expect(cache.get("peatedbot:robots:x")).resolves.toBeNull();
    await expect(
      cache.set("peatedbot:robots:x", "rules", 1_000),
    ).resolves.toBeUndefined();
  });
});
