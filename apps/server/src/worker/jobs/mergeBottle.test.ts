import { db } from "@peated/server/db";
import {
  actors,
  bottles,
  bottleTombstones,
  changes,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import { and, eq, inArray } from "drizzle-orm";
import { ZodError } from "zod";
import mergeBottle from "./mergeBottle";

describe("MergeBottle compatibility adapter", () => {
  test.each([
    undefined,
    { toBottleId: 1, fromBottleIds: [] },
    { toBottleId: 1, fromBottleIds: [2, 2] },
    { toBottleId: 1, fromBottleIds: [1] },
    { toBottleId: 1, fromBottleIds: [2], unexpected: true },
  ])("strictly rejects invalid payload %#", async (payload) => {
    await expect(mergeBottle(payload)).rejects.toBeInstanceOf(ZodError);
  });

  test("merges multiple sources atomically with the queued user actor and retries inertly", async ({
    fixtures,
  }) => {
    const sourceA = await fixtures.Bottle({ name: "Queued Source A" });
    const sourceB = await fixtures.Bottle({ name: "Queued Source B" });
    const destination = await fixtures.Bottle({ name: "Queued Destination" });
    const mod = await fixtures.User({ mod: true });
    const actor = await getUserActor(mod);
    const payload = {
      toBottleId: destination.id,
      fromBottleIds: [sourceA.id, sourceB.id],
    };
    const context = {
      actor: { type: "user" as const, userId: mod.id, username: mod.username },
    };

    await mergeBottle(payload, context);

    expect(
      await db
        .select({ id: bottles.id })
        .from(bottles)
        .where(inArray(bottles.id, [sourceA.id, sourceB.id])),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(bottleTombstones)
        .where(inArray(bottleTombstones.bottleId, [sourceA.id, sourceB.id])),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bottleId: sourceA.id,
          newBottleId: destination.id,
        }),
        expect.objectContaining({
          bottleId: sourceB.id,
          newBottleId: destination.id,
        }),
      ]),
    );
    const mergeAudits = await db
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.objectType, "bottle"),
          inArray(changes.objectId, [sourceA.id, sourceB.id]),
          eq(changes.type, "delete"),
        ),
      );
    expect(mergeAudits).toHaveLength(2);
    expect(mergeAudits.every(({ actorId }) => actorId === actor.id)).toBe(true);

    const auditCount = await db.$count(changes);
    await mergeBottle(payload, context);
    expect(await db.$count(changes)).toBe(auditCount);
  });

  test("rolls back every source when a later queued merge is invalid", async ({
    fixtures,
  }) => {
    const validSource = await fixtures.Bottle({ name: "Atomic Valid Source" });
    const invalidSource = await fixtures.LegacyBottle({
      name: "Atomic Unmigrated Source",
    });
    const destination = await fixtures.Bottle({ name: "Atomic Destination" });

    await expect(
      mergeBottle({
        toBottleId: destination.id,
        fromBottleIds: [validSource.id, invalidSource.id],
      }),
    ).rejects.toMatchObject({ code: "unmigrated" });

    expect(
      await db
        .select({ id: bottles.id })
        .from(bottles)
        .where(eq(bottles.id, validSource.id)),
    ).toEqual([{ id: validSource.id }]);
    expect(
      await db
        .select()
        .from(bottleTombstones)
        .where(eq(bottleTombstones.bottleId, validSource.id)),
    ).toEqual([]);
  });

  test("attributes a context-free legacy job to the Peated system actor", async ({
    fixtures,
  }) => {
    const source = await fixtures.Bottle({ name: "System Source" });
    const destination = await fixtures.Bottle({ name: "System Destination" });

    await mergeBottle({
      toBottleId: destination.id,
      fromBottleIds: [source.id],
    });

    const [audit] = await db
      .select({ actorType: actors.type, actorKey: actors.key })
      .from(changes)
      .innerJoin(actors, eq(changes.actorId, actors.id))
      .where(
        and(
          eq(changes.objectType, "bottle"),
          eq(changes.objectId, source.id),
          eq(changes.type, "delete"),
        ),
      );
    expect(audit).toEqual({ actorType: "system", actorKey: "peated" });
  });
});
