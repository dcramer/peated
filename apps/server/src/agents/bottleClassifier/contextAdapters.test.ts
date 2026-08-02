import { db } from "@peated/server/db";
import { bottleObservations } from "@peated/server/db/schema";
import { describe, expect, test } from "vitest";

import {
  getBottleClassifierContext,
  getEntityClassifierContext,
} from "./contextAdapters";

describe("Bottle classifier context adapters", () => {
  test("returns bounded catalog identity without user or tasting prose", async ({
    fixtures,
  }) => {
    const country = await fixtures.Country({
      name: "Context Scotland",
      slug: "context-scotland",
    });
    const region = await fixtures.Region({
      countryId: country.id,
      name: "Context Islay",
      slug: "context-islay",
    });
    const entity = await fixtures.Entity({
      name: "Context Laphroaig",
      shortName: "Laphroaig",
      type: ["brand", "distiller", "bottler"],
      countryId: country.id,
      regionId: region.id,
      yearEstablished: 1815,
      website: "https://example.com/laphroaig",
      description: "ENTITY_PRIVATE_DESCRIPTION",
      address: "ENTITY_PRIVATE_ADDRESS",
      totalBottles: 999,
      totalTastings: 888,
    });
    const bottle = await fixtures.Bottle({
      name: "Càirdeas",
      brandId: entity.id,
      bottlerId: entity.id,
      distillerIds: [entity.id],
      category: "single_malt",
      edition: "Warehouse 1",
      releaseYear: 2022,
      abv: 52.2,
      caskStrength: true,
      singleCask: false,
      imageUrl: "/context/bottle.webp",
      description: "BOTTLE_PRIVATE_DESCRIPTION",
      tastingNotes: {
        nose: "BOTTLE_PRIVATE_TASTING_NOTES",
        palate: "Private palate",
        finish: "Private finish",
      },
      totalTastings: 777,
    });
    const sibling = await fixtures.BottleGroupMember({
      groupId: bottle.groupId!,
      edition: "PX Cask",
      statedAge: 18,
      releaseYear: 2021,
      abv: 58.9,
      caskStrength: true,
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Laphroaig Cairdeas 2022",
      ignored: false,
    });
    await db.insert(bottleObservations).values({
      bottleId: bottle.id,
      sourceType: "store_price",
      sourceKey: `context-adapter:${bottle.id}`,
      sourceName: "Context Store",
      sourceUrl: "/context/listing",
      rawText: "Laphroaig Cairdeas 2022 Warehouse 1",
      parsedIdentity: { releaseYear: 2022 },
      facts: { abv: 52.2 },
    });
    const tastingUser = await fixtures.User({
      username: `private-context-user-${bottle.id}`,
    });
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: tastingUser.id,
      imageUrl: "/context/tasting.webp",
      notes: "PRIVATE_TASTING_NOTE",
      toasts: 123,
    });
    const privateTastingUser = await fixtures.User({
      username: `private-context-hidden-user-${bottle.id}`,
      private: true,
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: privateTastingUser.id,
      imageUrl: "/context/private-tasting.webp",
    });
    const inactiveTastingUser = await fixtures.User({
      username: `inactive-context-hidden-user-${bottle.id}`,
      active: false,
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: inactiveTastingUser.id,
      imageUrl: "/context/inactive-tasting.webp",
    });

    const context = await getBottleClassifierContext(bottle.id);

    expect(context).toMatchObject({
      bottleId: bottle.id,
      groupId: bottle.groupId,
      shared: {
        name: "Càirdeas",
        statedAge: null,
        brand: { entityId: entity.id, name: "Context Laphroaig" },
        distillers: [{ entityId: entity.id, name: "Context Laphroaig" }],
        bottler: { entityId: entity.id, name: "Context Laphroaig" },
      },
      exact: {
        edition: "Warehouse 1",
        releaseYear: 2022,
      },
      siblings: [{ bottleId: sibling.id, exact: { statedAge: 18 } }],
      observations: [
        {
          sourceKey: `context-adapter:${bottle.id}`,
          sourceUrl: expect.stringContaining("/context/listing"),
        },
      ],
      imageSources: [
        {
          source: { kind: "bottle" },
          url: expect.stringContaining("/context/bottle.webp"),
        },
        {
          source: { kind: "tasting", tastingId: tasting.id },
          url: expect.stringContaining("/context/tasting.webp"),
        },
      ],
    });
    expect(context?.aliases).toContainEqual({
      name: "Laphroaig Cairdeas 2022",
      ignored: false,
    });
    expect(context?.imageSources).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: expect.stringContaining("/context/private-tasting.webp"),
        }),
        expect.objectContaining({
          url: expect.stringContaining("/context/inactive-tasting.webp"),
        }),
      ]),
    );

    const serialized = JSON.stringify(context);
    for (const privateValue of [
      "ENTITY_PRIVATE_DESCRIPTION",
      "ENTITY_PRIVATE_ADDRESS",
      "BOTTLE_PRIVATE_DESCRIPTION",
      "BOTTLE_PRIVATE_TASTING_NOTES",
      "PRIVATE_TASTING_NOTE",
      tastingUser.username,
      '"toasts"',
      '"totalTastings"',
      '"createdById"',
      '"createdByActorId"',
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  test("returns narrow Entity identity and related Bottle roles", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      name: "Context Multi Role Entity",
      shortName: "Context Entity",
      type: ["brand", "distiller", "bottler"],
      website: "https://example.com/entity",
      description: "ENTITY_DESCRIPTION_MUST_NOT_ESCAPE",
      address: "ENTITY_ADDRESS_MUST_NOT_ESCAPE",
      totalBottles: 111,
      totalTastings: 222,
    });
    await fixtures.EntityAlias({
      entityId: entity.id,
      name: "Context Entity Alias",
    });
    const bottle = await fixtures.Bottle({
      name: "Context Multi Role Bottle",
      brandId: entity.id,
      bottlerId: entity.id,
      distillerIds: [entity.id],
    });

    const context = await getEntityClassifierContext(entity.id);

    expect(context).toMatchObject({
      entityId: entity.id,
      name: "Context Multi Role Entity",
      shortName: "Context Entity",
      roles: ["brand", "distiller", "bottler"],
      website: "https://example.com/entity",
      aliases: expect.arrayContaining(["Context Entity Alias"]),
      relatedBottles: [
        {
          bottleId: bottle.id,
          relationships: ["brand", "bottler", "distiller"],
        },
      ],
    });
    const serialized = JSON.stringify(context);
    expect(serialized).not.toContain("ENTITY_DESCRIPTION_MUST_NOT_ESCAPE");
    expect(serialized).not.toContain("ENTITY_ADDRESS_MUST_NOT_ESCAPE");
    expect(serialized).not.toContain("totalBottles");
    expect(serialized).not.toContain("totalTastings");
    expect(serialized).not.toContain("createdByActorId");
  });
});
