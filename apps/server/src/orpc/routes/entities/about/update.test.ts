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

    expect(err).toMatchInlineSnapshot(
      `[Error: The About document is not valid. Event 1 needs a source.]`,
    );
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
      `[Error: The About document is not valid. A sentence in lead needs a source.]`,
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
      `[Error: The About document is not valid. Site fact washStills does not apply to a brand.]`,
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
