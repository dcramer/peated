import { db } from "@peated/server/db";
import { getEntityAbout } from "@peated/server/lib/entityAbout/store";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("POST /admin/catalog/backfill-entity-about", () => {
  test("reports an Entity it cannot copy and continues", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const broken = await fixtures.Entity();
    await fixtures.EntityEvent({
      entityId: broken.id,
      kind: "generic",
      date: "1900",
      description: "x".repeat(1001),
    });
    const badUrl = await fixtures.Entity();
    const unparsable = await fixtures.EntityEvent({
      entityId: badUrl.id,
      kind: "opened",
      date: "1819",
      sourceUrl: "not a url",
    });
    const fine = await fixtures.Entity();
    await fixtures.EntityEvent({
      entityId: fine.id,
      kind: "opened",
      date: "1819",
    });

    const result = await routerClient.admin.backfillEntityAbout(
      {},
      { context: { user: admin } },
    );

    expect(result.copiedEvents).toBe(1);
    expect(result.failed).toEqual([
      { entityId: broken.id, reasons: [expect.stringContaining("text")] },
      {
        entityId: badUrl.id,
        reasons: [`History item ${unparsable.id} has an invalid source URL.`],
      },
    ]);
    expect(await getEntityAbout(db, fine.id)).not.toBeNull();
  });

  test("copies legacy history into About documents", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const entity = await fixtures.Entity();
    const opened = await fixtures.EntityEvent({
      entityId: entity.id,
      kind: "opened",
      date: "1819",
      sourceUrl: "https://example.com/history",
    });
    const closed = await fixtures.EntityEvent({
      entityId: entity.id,
      kind: "closed",
      date: "1983",
      sourceUrl: "https://example.com/history",
    });
    const uncited = await fixtures.EntityEvent({
      entityId: entity.id,
      kind: "reopened",
      date: "2021",
    });

    const result = await routerClient.admin.backfillEntityAbout(
      {},
      { context: { user: admin } },
    );

    expect(result).toEqual({
      copiedEvents: 3,
      entities: 1,
      failed: [],
      nextAfterId: null,
    });
    const about = await getEntityAbout(db, entity.id);
    expect(about?.document.events.map(({ id }) => id)).toEqual([
      opened.id,
      closed.id,
      uncited.id,
    ]);
    // Events that shared a URL share one source.
    expect(about?.document.sources).toHaveLength(1);
    expect(about?.document.events[2]?.citations).toEqual([]);
  });

  test("is safe to repeat", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const entity = await fixtures.Entity();
    await fixtures.EntityEvent({
      entityId: entity.id,
      sourceUrl: "https://example.com/history",
    });

    await routerClient.admin.backfillEntityAbout(
      {},
      { context: { user: admin } },
    );
    const second = await routerClient.admin.backfillEntityAbout(
      {},
      { context: { user: admin } },
    );

    expect(second.copiedEvents).toBe(0);
    expect((await getEntityAbout(db, entity.id))?.version).toBe(1);
  });

  test("does not bring back history a moderator deleted", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const entity = await fixtures.Entity();
    const row = await fixtures.EntityEvent({
      entityId: entity.id,
      sourceUrl: "https://example.com/history",
    });
    await routerClient.admin.backfillEntityAbout(
      {},
      { context: { user: admin } },
    );
    const copied = (await getEntityAbout(db, entity.id))!.document.events[0]!;

    await routerClient.entities.events.delete(
      { entity: entity.id, event: copied.id },
      { context: { user: admin } },
    );
    const again = await routerClient.admin.backfillEntityAbout(
      {},
      { context: { user: admin } },
    );

    expect(copied.legacyEventId).toBe(row.id);
    expect(again.copiedEvents).toBe(0);
    expect((await getEntityAbout(db, entity.id))?.document.events).toEqual([]);
  });

  test("copies rows whose IDs match unrelated document events", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const entity = await fixtures.Entity();
    const row = await fixtures.EntityEvent({
      entityId: entity.id,
      kind: "opened",
      date: "1819",
      sourceUrl: "https://example.com/history",
    });
    // An item added before the backfill, with the same ID as the legacy row.
    await fixtures.EntityAbout({
      entityId: entity.id,
      events: [{ id: row.id, kind: "closed", date: "1983" }],
    });

    const result = await routerClient.admin.backfillEntityAbout(
      {},
      { context: { user: admin } },
    );

    expect(result.copiedEvents).toBe(1);
    const about = await getEntityAbout(db, entity.id);
    expect(
      about?.document.events.map(({ kind, legacyEventId }) => [
        kind,
        legacyEventId,
      ]),
    ).toEqual([
      ["closed", null],
      ["opened", row.id],
    ]);
  });

  test("pages through Entities", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const first = await fixtures.Entity();
    const second = await fixtures.Entity();
    await fixtures.EntityEvent({ entityId: first.id });
    await fixtures.EntityEvent({ entityId: second.id });

    const page = await routerClient.admin.backfillEntityAbout(
      { limit: 1 },
      { context: { user: admin } },
    );

    expect(page).toMatchObject({ entities: 1, nextAfterId: first.id });
  });

  test("requires administrator privileges", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      routerClient.admin.backfillEntityAbout({}, { context: { user } }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });
});
