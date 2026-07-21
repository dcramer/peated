import config from "@peated/server/config";
import { db } from "@peated/server/db";
import {
  bottleGroups,
  bottleTombstones,
  catalogTargets,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, vi } from "vitest";
import notifyDiscordOnTasting from "./notifyDiscordOnTasting";

const originalDiscordWebhook = config.DISCORD_WEBHOOK;
const originalUrlPrefix = config.URL_PREFIX;

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  config.DISCORD_WEBHOOK = "https://discord.example/webhook";
  config.URL_PREFIX = "https://peated.example";
  fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  config.DISCORD_WEBHOOK = originalDiscordWebhook;
  config.URL_PREFIX = originalUrlPrefix;
  vi.unstubAllGlobals();
});

type DiscordEmbed = {
  title: string;
  fields: Array<{ name: string; value: string; inline: boolean }>;
};

async function sentEmbed(): Promise<DiscordEmbed> {
  expect(fetchMock).toHaveBeenCalledOnce();
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
  if (typeof init?.body !== "string") {
    throw new Error("Discord webhook body was not serialized");
  }
  const payload = JSON.parse(init.body) as { embeds: DiscordEmbed[] };
  const embed = payload.embeds[0];
  if (!embed) throw new Error("Discord webhook did not contain an embed");
  return embed;
}

test("uses the exact Bottle label for an exact tasting target", async ({
  fixtures,
}) => {
  const bottle = await fixtures.Bottle({ name: "Exact Notification" });
  const groupLabel = "Distinct Exact Discord Group Label";
  await db
    .update(bottleGroups)
    .set({ fullName: groupLabel })
    .where(eq(bottleGroups.id, bottle.groupId as number));
  const tasting = await fixtures.Tasting({ bottleId: bottle.id });

  await notifyDiscordOnTasting({ tastingId: tasting.id });

  const embed = await sentEmbed();
  expect(embed.title).toBe(bottle.fullName);
  expect(embed.title).not.toBe(groupLabel);
  expect(embed.fields).not.toContainEqual({
    name: "Bottle",
    value: "Exact bottle not specified",
    inline: true,
  });
});

test("uses the BottleGroup label for a generic tasting target", async ({
  fixtures,
}) => {
  const bottle = await fixtures.Bottle({ name: "Exact Notification" });
  const genericTarget = await db.query.catalogTargets.findFirst({
    where: (catalogTargets, { and, eq, isNull }) =>
      and(
        eq(catalogTargets.groupId, bottle.groupId as number),
        isNull(catalogTargets.bottleId),
      ),
  });
  if (!genericTarget) throw new Error("Missing generic target fixture");
  await db
    .update(bottleGroups)
    .set({ fullName: "Generic Notification Label" })
    .where(eq(bottleGroups.id, bottle.groupId as number));
  const tasting = await fixtures.Tasting({
    bottleId: bottle.id,
    targetId: genericTarget.id,
  });

  await notifyDiscordOnTasting({ tastingId: tasting.id });

  const embed = await sentEmbed();
  expect(embed.title).toBe("Generic Notification Label");
  expect(embed.title).not.toBe(bottle.fullName);
  expect(embed.fields).toContainEqual({
    name: "Bottle",
    value: "Exact bottle not specified",
    inline: true,
  });
});

test("rejects a targetless tasting without sending a webhook", async ({
  fixtures,
}) => {
  const bottle = await fixtures.Bottle();
  const tasting = await fixtures.Tasting({
    bottleId: bottle.id,
    targetId: null,
  });

  await expect(
    notifyDiscordOnTasting({ tastingId: tasting.id }),
  ).rejects.toThrow(`Tasting ${tasting.id} has no CatalogTarget`);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("rejects a retired exact target without sending a webhook", async ({
  fixtures,
}) => {
  const bottle = await fixtures.Bottle();
  const tasting = await fixtures.Tasting({ bottleId: bottle.id });
  const target = await db.query.catalogTargets.findFirst({
    where: eq(catalogTargets.bottleId, bottle.id),
  });
  if (!target) throw new Error("Missing exact target fixture");
  await db.insert(bottleTombstones).values({ bottleId: bottle.id });

  await expect(
    notifyDiscordOnTasting({ tastingId: tasting.id }),
  ).rejects.toMatchObject({
    code: "CATALOG_TARGET_RETIRED",
    identity: { bottleId: bottle.id },
  });
  expect(fetchMock).not.toHaveBeenCalled();
});
