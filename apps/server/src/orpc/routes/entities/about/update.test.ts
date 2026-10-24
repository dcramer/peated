import { db } from "@peated/server/db";
import { getEntityAbout } from "@peated/server/lib/entityAbout/store";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

const source = {
  id: "s1",
  url: "https://example.com/history",
  title: "History",
  kind: "reference" as const,
};

describe("PUT /entities/:entity/about", () => {
  test("saves a moderator's edits as written by a person", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({ kind: "distillery" });
    await fixtures.EntityAbout({
      entityId: entity.id,
      events: [
        { id: 1, kind: "opened", date: "1819", writtenBy: "pipeline" },
        { id: 2, kind: "closed", date: "1983", writtenBy: "pipeline" },
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
          siteFacts: {
            washStills: {
              value: 1,
              asOf: "2021",
              citations: [{ sourceId: "s1", statedValue: "1", quote: null }],
              writtenBy: "pipeline",
            },
          },
        },
      },
      { context: { user } },
    );

    expect(about.version).toBe(2);
    const saved = await getEntityAbout(db, entity.id);
    expect(
      saved?.document.events.map(({ id, writtenBy }) => [id, writtenBy]),
    ).toEqual([
      [1, "pipeline"],
      [2, "person"],
    ]);
    expect(saved?.document.siteFacts.washStills?.writtenBy).toBe("person");
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
            events: [
              { id: 1, kind: "closed", date: "1983", writtenBy: "person" },
            ],
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
                writtenBy: "person",
                citations: [{ sourceId: "s1" }],
              },
            ],
            sections: [
              {
                key: "lead",
                writtenBy: "person",
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
                writtenBy: "person",
                citations: [{ sourceId: "s1" }],
              },
            ],
            sections: [
              {
                key: "history",
                writtenBy: "person",
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
                writtenBy: "person",
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
  test("round-trips the full document so unchanged items keep their author", async ({
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
          writtenBy: "pipeline",
          citations: [
            { sourceId: "s1", statedValue: "1819", quote: "Founded in 1819." },
          ],
        },
        { id: 2, kind: "closed", date: "1983", writtenBy: "pipeline" },
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
      stored?.document.events.map(({ id, writtenBy, citations }) => [
        id,
        writtenBy,
        citations[0]?.quote ?? null,
      ]),
    ).toEqual([
      [1, "pipeline", "Founded in 1819."],
      [2, "person", null],
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
