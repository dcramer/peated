import { db } from "@peated/server/db";
import { changes, entities } from "@peated/server/db/schema";
import {
  getPeatedSystemActorForDatabase,
  getUserActorForDatabase,
} from "@peated/server/lib/actors";
import { routerClient } from "@peated/server/orpc/router";
import { and, desc, eq } from "drizzle-orm";

/** Records a change shaped like the old Entity details job's. */
async function recordGuess(
  entityId: number,
  data: Record<string, string | number | null>,
) {
  const actor = await getPeatedSystemActorForDatabase(db);
  await db.insert(changes).values({
    objectType: "entity",
    objectId: entityId,
    displayName: "Guess",
    actorId: actor.id,
    type: "update",
    data,
  });
}

async function readEntity(entityId: number) {
  const [entity] = await db
    .select({
      yearEstablished: entities.yearEstablished,
      website: entities.website,
    })
    .from(entities)
    .where(eq(entities.id, entityId));
  return entity;
}

describe("POST /admin/catalog/clear-guessed-entity-details", () => {
  test("dry run lists guessed values and changes nothing", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const entity = await fixtures.Entity({
      kind: "distillery",
      yearEstablished: 1823,
      website: "https://example.com",
    });
    await recordGuess(entity.id, {
      yearEstablished: 1823,
      website: "https://example.com",
      pronunciation: "ex-AM-pul",
    });

    const result = await routerClient.admin.clearGuessedEntityDetails(
      { dryRun: true },
      { context: { user: admin } },
    );

    expect(result.guesses).toMatchObject([
      { entityId: entity.id, field: "yearEstablished", value: 1823 },
      { entityId: entity.id, field: "website", value: "https://example.com" },
    ]);
    expect(result.guesses.map(({ newValue }) => newValue)).toEqual([
      null,
      null,
    ]);
    expect(await readEntity(entity.id)).toEqual({
      yearEstablished: 1823,
      website: "https://example.com",
    });
  });

  test("clears guessed values and keeps them in the change", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const entity = await fixtures.Entity({
      kind: "distillery",
      yearEstablished: 1823,
      website: "https://example.com",
    });
    await recordGuess(entity.id, { yearEstablished: 1823 });
    await recordGuess(entity.id, { website: "https://example.com" });

    const result = await routerClient.admin.clearGuessedEntityDetails(
      {},
      { context: { user: admin } },
    );

    expect(result.guesses).toHaveLength(2);
    expect(await readEntity(entity.id)).toEqual({
      yearEstablished: null,
      website: null,
    });
    const [change] = await db
      .select({ data: changes.data })
      .from(changes)
      .where(
        and(eq(changes.objectType, "entity"), eq(changes.objectId, entity.id)),
      )
      .orderBy(desc(changes.id))
      .limit(1);
    expect(change?.data).toEqual({
      yearEstablished: null,
      website: null,
      before: { yearEstablished: 1823, website: "https://example.com" },
    });

    const again = await routerClient.admin.clearGuessedEntityDetails(
      { dryRun: true },
      { context: { user: admin } },
    );
    expect(again.guesses).toEqual([]);
  });

  test("uses the year a published About page cites", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const entity = await fixtures.Entity({
      kind: "distillery",
      yearEstablished: 1823,
    });
    await recordGuess(entity.id, { yearEstablished: 1823 });
    await fixtures.EntityAbout({
      entityId: entity.id,
      events: [{ id: 1, kind: "opened", date: "1824" }],
    });

    const result = await routerClient.admin.clearGuessedEntityDetails(
      {},
      { context: { user: admin } },
    );

    expect(result.guesses).toMatchObject([
      { field: "yearEstablished", value: 1823, newValue: 1824 },
    ]);
    expect((await readEntity(entity.id))?.yearEstablished).toBe(1824);
  });

  test("clears a guessed year when the About page dates a future opening", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const entity = await fixtures.Entity({
      kind: "distillery",
      yearEstablished: 1823,
    });
    await recordGuess(entity.id, { yearEstablished: 1823 });
    await fixtures.EntityAbout({
      entityId: entity.id,
      events: [
        {
          id: 1,
          kind: "opened",
          date: String(new Date().getFullYear() + 1),
        },
      ],
    });

    const result = await routerClient.admin.clearGuessedEntityDetails(
      {},
      { context: { user: admin } },
    );

    expect(result.guesses).toMatchObject([
      { field: "yearEstablished", value: 1823, newValue: null },
    ]);
    expect((await readEntity(entity.id))?.yearEstablished).toBeNull();
  });

  test("keeps values the job did not set last", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const moderator = await fixtures.User({ mod: true });
    // Set when the Entity was created, not by the job.
    const created = await fixtures.Entity({ yearEstablished: 1823 });
    // A person set it after the job did.
    const edited = await fixtures.Entity({ yearEstablished: 1824 });
    await recordGuess(edited.id, { yearEstablished: 1823 });
    await db.insert(changes).values({
      objectType: "entity",
      objectId: edited.id,
      displayName: edited.name,
      actorId: (await getUserActorForDatabase(db, moderator)).id,
      type: "update",
      data: { yearEstablished: 1824 },
    });
    // The change also set a field the job never wrote.
    const otherJob = await fixtures.Entity({ website: "https://example.com" });
    await recordGuess(otherJob.id, {
      website: "https://example.com",
      name: "Renamed",
    });
    // The About page cites the guessed year.
    const confirmed = await fixtures.Entity({
      kind: "distillery",
      yearEstablished: 1823,
    });
    await recordGuess(confirmed.id, { yearEstablished: 1823 });
    await fixtures.EntityAbout({
      entityId: confirmed.id,
      events: [{ id: 1, kind: "opened", date: "1823" }],
    });

    const result = await routerClient.admin.clearGuessedEntityDetails(
      {},
      { context: { user: admin } },
    );

    expect(result.guesses).toEqual([]);
    expect((await readEntity(created.id))?.yearEstablished).toBe(1823);
    expect((await readEntity(edited.id))?.yearEstablished).toBe(1824);
    expect((await readEntity(otherJob.id))?.website).toBe(
      "https://example.com",
    );
    expect((await readEntity(confirmed.id))?.yearEstablished).toBe(1823);
  });

  test("pages through Entities with nextAfterId", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const first = await fixtures.Entity({ yearEstablished: 1823 });
    const second = await fixtures.Entity({ yearEstablished: 1824 });
    await recordGuess(first.id, { yearEstablished: 1823 });
    await recordGuess(second.id, { yearEstablished: 1824 });

    const firstPage = await routerClient.admin.clearGuessedEntityDetails(
      { dryRun: true, limit: 1 },
      { context: { user: admin } },
    );
    expect(firstPage).toMatchObject({
      guesses: [{ entityId: first.id }],
      nextAfterId: first.id,
    });

    const secondPage = await routerClient.admin.clearGuessedEntityDetails(
      { dryRun: true, limit: 1, afterId: firstPage.nextAfterId! },
      { context: { user: admin } },
    );
    expect(secondPage).toMatchObject({
      guesses: [{ entityId: second.id }],
      nextAfterId: null,
    });
  });

  test("requires administrator access", async ({ fixtures }) => {
    const moderator = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({ yearEstablished: 1823 });
    await recordGuess(entity.id, { yearEstablished: 1823 });

    await expect(
      routerClient.admin.clearGuessedEntityDetails(
        {},
        { context: { user: moderator } },
      ),
    ).rejects.toThrow();
    expect((await readEntity(entity.id))?.yearEstablished).toBe(1823);
  });
});
