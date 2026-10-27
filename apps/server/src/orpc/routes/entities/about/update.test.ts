import { db } from "@peated/server/db";
import { changes, entities, type User } from "@peated/server/db/schema";
import { getEntityAbout } from "@peated/server/lib/entityAbout/store";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";

const source = {
  id: "s1",
  url: "https://example.com/history",
  title: "History",
  kind: "reference" as const,
};

describe("PUT /entities/:entity/about", () => {
  test("saves a moderator's edit as a new version", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({ kind: "distillery" });
    await fixtures.EntityAbout({
      entityId: entity.id,
      events: [
        { id: 1, kind: "opened", date: "1819" },
        { id: 2, kind: "closed", date: "1983" },
      ],
    });
    const stored = await getEntityAbout(db, entity.id);

    const about = await routerClient.entities.about.update(
      {
        entity: entity.id,
        version: 1,
        document: {
          ...stored!.document,
          events: stored!.document.events.map((event) =>
            event.id === 2 ? { ...event, date: "1983-03" } : event,
          ),
        },
      },
      { context: { user } },
    );

    expect(about.version).toBe(2);
    const saved = await getEntityAbout(db, entity.id);
    expect(saved?.document.events.map(({ date }) => date)).toEqual([
      "1819",
      "1983-03",
    ]);
  });

  test("updates a generated description to the new lead", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({
      kind: "distillery",
      description: "An old generated description.",
      descriptionSrc: "generated",
    });
    const event = (id: number, kind: "opened" | "closed", date: string) => ({
      id,
      kind,
      date,
      citations: [{ sourceId: "s1" }],
    });

    await routerClient.entities.about.update(
      {
        entity: entity.id,
        version: null,
        document: {
          sources: [source],
          events: [event(1, "opened", "1819"), event(2, "closed", "1983")],
          sections: [
            {
              key: "lead",
              sentences: [
                { text: "It opened in 1819.", factIds: ["event:1"] },
                { text: "It closed in 1983.", factIds: ["event:2"] },
              ],
            },
          ],
        },
      },
      { context: { user } },
    );

    const [updated] = await db
      .select({ description: entities.description })
      .from(entities)
      .where(eq(entities.id, entity.id));
    expect(updated?.description).toBe("It opened in 1819. It closed in 1983.");
  });

  describe("founding year", () => {
    const opened = (
      id: number,
      date: string,
      citations: { sourceId: string; statedValue?: string }[],
    ) => ({ id, kind: "opened" as const, date, citations });

    async function savePage(
      user: User,
      entityId: number,
      events: ReturnType<typeof opened>[],
      sources = [source],
    ) {
      await routerClient.entities.about.update(
        {
          entity: entityId,
          version: null,
          document: {
            sources,
            events,
            sections: [
              {
                key: "lead",
                sentences: [
                  { text: "It opened long ago.", factIds: ["event:1"] },
                ],
              },
            ],
          },
        },
        { context: { user } },
      );
      const [entity] = await db
        .select({ yearEstablished: entities.yearEstablished })
        .from(entities)
        .where(eq(entities.id, entityId));
      return entity?.yearEstablished;
    }

    test("replaces the stored year with the cited opening year", async ({
      fixtures,
    }) => {
      const user = await fixtures.User({ mod: true });
      const entity = await fixtures.Entity({
        kind: "distillery",
        yearEstablished: 1820,
      });

      await expect(
        savePage(user, entity.id, [
          opened(1, "1819-05", [{ sourceId: "s1", statedValue: "1819" }]),
        ]),
      ).resolves.toBe(1819);

      const history = await db
        .select({ data: changes.data })
        .from(changes)
        .where(
          and(
            eq(changes.objectType, "entity"),
            eq(changes.objectId, entity.id),
          ),
        );
      expect(history.map(({ data }) => data)).toContainEqual({
        yearEstablished: 1819,
        before: { yearEstablished: 1820 },
      });
    });

    test("keeps the stored year when sources disagree", async ({
      fixtures,
    }) => {
      const user = await fixtures.User({ mod: true });
      const entity = await fixtures.Entity({
        kind: "distillery",
        yearEstablished: 1820,
      });

      await expect(
        savePage(
          user,
          entity.id,
          [
            opened(1, "1819", [
              { sourceId: "s1", statedValue: "1819" },
              { sourceId: "s2", statedValue: "1822" },
            ]),
          ],
          [source, { ...source, id: "s2", url: "https://example.com/other" }],
        ),
      ).resolves.toBe(1820);
    });

    test("keeps the stored year when the page has two openings", async ({
      fixtures,
    }) => {
      const user = await fixtures.User({ mod: true });
      const entity = await fixtures.Entity({
        kind: "distillery",
        yearEstablished: 1820,
      });

      await expect(
        savePage(user, entity.id, [
          opened(1, "1819", [{ sourceId: "s1" }]),
          opened(2, "1824", [{ sourceId: "s1" }]),
        ]),
      ).resolves.toBe(1820);
    });
  });

  test("rejects an edit based on an older version", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    await fixtures.EntityAbout({
      entityId: entity.id,
      version: 4,
      events: [{ id: 1 }],
    });
    const stored = await getEntityAbout(db, entity.id);

    const err = await waitError(() =>
      routerClient.entities.about.update(
        { entity: entity.id, version: 3, document: stored!.document },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: About for entity ${entity.id} changed since it was read.]`,
    );
  });

  test("rejects a new fact without a source", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();

    const err = await waitError(() =>
      routerClient.entities.about.update(
        {
          entity: entity.id,
          version: null,
          document: {
            sources: [source],
            events: [{ id: 1, kind: "closed", date: "1983" }],
          },
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Event 1 needs a source.]`);
  });

  test("rejects a sentence without a source", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();

    const err = await waitError(() =>
      routerClient.entities.about.update(
        {
          entity: entity.id,
          version: null,
          document: {
            sources: [source],
            events: [
              {
                id: 1,
                kind: "closed",
                date: "1983",
                citations: [{ sourceId: "s1" }],
              },
            ],
            sections: [
              {
                key: "lead",
                sentences: [{ text: "A fine distillery.", factIds: [] }],
              },
            ],
          },
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: A sentence in lead needs a source.]`,
    );
  });

  test("rejects a section without a heading", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();

    const err = await waitError(() =>
      routerClient.entities.about.update(
        {
          entity: entity.id,
          version: null,
          document: {
            sources: [source],
            events: [
              {
                id: 1,
                kind: "closed",
                date: "1983",
                citations: [{ sourceId: "s1" }],
              },
            ],
            sections: [
              {
                key: "history",
                sentences: [
                  { text: "It closed in 1983.", factIds: ["event:1"] },
                ],
              },
            ],
          },
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Section history needs a heading.]`,
    );
  });

  test("rejects site facts on a brand", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({ kind: "brand" });

    const err = await waitError(() =>
      routerClient.entities.about.update(
        {
          entity: entity.id,
          version: null,
          document: {
            sources: [source],
            siteFacts: {
              washStills: {
                value: 2,
                citations: [{ sourceId: "s1" }],
              },
            },
          },
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Site fact washStills does not apply to a brand.]`,
    );
  });

  test("requires moderator privileges", async ({ fixtures }) => {
    const user = await fixtures.User();
    const entity = await fixtures.Entity();

    const err = await waitError(() =>
      routerClient.entities.about.update(
        { entity: entity.id, version: null, document: {} },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });
});

describe("PATCH /entities/:entity/about/status", () => {
  test("hides and shows a page", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    await fixtures.EntityAbout({ entityId: entity.id, events: [{ id: 1 }] });

    await routerClient.entities.about.status(
      { entity: entity.id, status: "hidden" },
      { context: { user } },
    );
    expect(
      await routerClient.entities.about.details({ entity: entity.id }),
    ).toBeNull();

    await routerClient.entities.about.status(
      { entity: entity.id, status: "published" },
      { context: { user } },
    );
    expect(
      await routerClient.entities.about.details({ entity: entity.id }),
    ).not.toBeNull();
  });
});

describe("GET /entities/:entity/about/document", () => {
  test("round-trips the full document with its quotes", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({ kind: "distillery" });
    await fixtures.EntityAbout({
      entityId: entity.id,
      events: [
        {
          id: 1,
          kind: "opened",
          date: "1819",
          citations: [
            { sourceId: "s1", statedValue: "1819", quote: "Founded in 1819." },
          ],
        },
        { id: 2, kind: "closed", date: "1983" },
      ],
    });

    const { version, document } = await routerClient.entities.about.document(
      { entity: entity.id },
      { context: { user } },
    );
    await routerClient.entities.about.update(
      {
        entity: entity.id,
        version,
        document: {
          ...document!,
          events: document!.events.map((event) =>
            event.id === 2 ? { ...event, date: "1983-03" } : event,
          ),
        },
      },
      { context: { user } },
    );

    const stored = await getEntityAbout(db, entity.id);
    expect(
      stored?.document.events.map(({ id, citations }) => [
        id,
        citations[0]?.quote ?? null,
      ]),
    ).toEqual([
      [1, "Founded in 1819."],
      [2, null],
    ]);
  });

  test("keeps the full document from people who are not moderators", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const entity = await fixtures.Entity();

    const err = await waitError(() =>
      routerClient.entities.about.document(
        { entity: entity.id },
        { context: { user } },
      ),
    );

    expect(err).toMatchObject({ code: "UNAUTHORIZED" });
  });
});
