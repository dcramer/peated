import { db } from "@peated/server/db";
import {
  actors,
  bottleAliases,
  bottles,
  changes,
  entities,
  entityAliases,
} from "@peated/server/db/schema";
import {
  EntityUpdateAuthorizationError,
  EntityUpdateConflictError,
  EntityUpdateNotFoundError,
  updateEntity,
} from "@peated/server/lib/updateEntity";
import { and, desc, eq } from "drizzle-orm";

describe("updateEntity", () => {
  test("updates through the canonical transaction with moderator attribution and Brand rematerialization", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      name: "Old Harbor",
      type: ["brand", "distiller"],
    });
    const bottle = await fixtures.Bottle({
      brandId: entity.id,
      name: "Storm Cask",
    });
    const groupMember = await fixtures.BottleGroupMember({
      groupId: bottle.groupId,
      edition: "Second Release",
    });
    const moderator = await fixtures.User({
      mod: true,
      username: "catalog-moderator",
    });

    const result = await updateEntity({
      entityId: entity.id,
      input: { name: "  Harbor House  " },
      user: moderator,
    });

    expect(result).toMatchObject({
      changed: true,
      entity: {
        id: entity.id,
        name: "Harbor House",
      },
    });

    for (const original of [bottle, groupMember]) {
      const updated = await db.query.bottles.findFirst({
        where: eq(bottles.id, original.id),
      });
      expect(updated?.fullName).toMatch(/^Harbor House /);

      const aliases = await db
        .select()
        .from(bottleAliases)
        .where(eq(bottleAliases.bottleId, original.id));
      expect(aliases).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: original.fullName }),
          expect.objectContaining({ name: updated?.fullName }),
        ]),
      );
    }

    expect(
      await db.query.entityAliases.findFirst({
        where: eq(entityAliases.name, "Old Harbor"),
      }),
    ).toBeUndefined();
    expect(
      await db.query.entityAliases.findFirst({
        where: eq(entityAliases.name, "Harbor House"),
      }),
    ).toMatchObject({ entityId: entity.id });

    const change = await db.query.changes.findFirst({
      where: and(
        eq(changes.objectType, "entity"),
        eq(changes.objectId, entity.id),
      ),
      orderBy: desc(changes.id),
    });
    expect(change).toMatchObject({
      displayName: "Harbor House",
      data: { name: "Harbor House" },
    });

    const actor = await db.query.actors.findFirst({
      where: eq(actors.id, change!.actorId),
    });
    expect(actor).toMatchObject({
      type: "user",
      userId: moderator.id,
      displayName: moderator.username,
    });
  });

  test("rolls back a direct update when the canonical alias is owned elsewhere", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ name: "Original Distillery" });
    const aliasOwner = await fixtures.Entity({ name: "Alias Owner" });
    await fixtures.EntityAlias({
      entityId: aliasOwner.id,
      name: "Claimed Name",
    });
    const moderator = await fixtures.User({ mod: true });

    await expect(
      updateEntity({
        entityId: entity.id,
        input: { name: "Claimed Name" },
        user: moderator,
      }),
    ).rejects.toMatchObject({
      name: EntityUpdateConflictError.name,
      message: `Duplicate entity alias found (${aliasOwner.id}) for "Claimed Name".`,
    });

    const unchanged = await db.query.entities.findFirst({
      where: eq(entities.id, entity.id),
    });
    expect(unchanged?.name).toBe("Original Distillery");
  });

  test("keeps authorization and missing targets explicit at the service boundary", async ({
    defaults,
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });

    await expect(
      updateEntity({
        entityId: 999999,
        input: { website: "https://example.com" },
        user: moderator,
      }),
    ).rejects.toBeInstanceOf(EntityUpdateNotFoundError);

    await expect(
      updateEntity({
        entityId: 999999,
        input: { website: "https://example.com" },
        user: defaults.user,
      }),
    ).rejects.toBeInstanceOf(EntityUpdateAuthorizationError);
  });

  test("rejects removing Entity roles that active Bottle identity references", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      name: "All Roles",
      type: ["brand", "bottler", "distiller"],
    });
    await fixtures.Bottle({
      brandId: entity.id,
      bottlerId: entity.id,
      distillerIds: [entity.id],
    });
    const moderator = await fixtures.User({ mod: true });
    const scenarios = [
      {
        role: "brand" as const,
        message:
          "Cannot remove the brand role while the Entity is referenced as a brand.",
      },
      {
        role: "bottler" as const,
        message:
          "Cannot remove the bottler role while the Entity is referenced as a bottler.",
      },
      {
        role: "distiller" as const,
        message:
          "Cannot remove the distiller role while the Entity is referenced as a distiller.",
      },
    ];

    for (const { role, message } of scenarios) {
      await expect(
        updateEntity({
          entityId: entity.id,
          input: {
            type: entity.type.filter((candidate) => candidate !== role),
          },
          user: moderator,
        }),
      ).rejects.toMatchObject({
        name: EntityUpdateConflictError.name,
        message,
      });
    }

    const unchanged = await db.query.entities.findFirst({
      where: eq(entities.id, entity.id),
    });
    expect(unchanged?.type).toEqual(entity.type);
  });
});
