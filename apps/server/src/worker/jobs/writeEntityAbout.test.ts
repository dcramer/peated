import type { AboutDraft } from "@peated/server/agents/entityAbout/draftSchema";
import type { EntityAboutWriter } from "@peated/server/agents/entityAbout/writer";
import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { getEntityAbout } from "@peated/server/lib/entityAbout/store";
import { eq } from "drizzle-orm";
import { vi } from "vitest";

import { writeEntityAbout } from "./writeEntityAbout";

const page = {
  url: "https://en.wikipedia.org/wiki/Brora_distillery",
  text: "Brora distillery was founded in 1819. Production at Brora was stopped in early 1983. It has 1 wash still.",
};

function draft(
  sentences: AboutDraft["sections"][number]["sentences"],
): AboutDraft {
  return {
    sources: [
      {
        id: "wp",
        url: page.url,
        title: "Brora distillery",
        publisher: "Wikipedia",
        publishedOn: null,
        kind: "reference",
      },
    ],
    events: [
      {
        id: 1,
        kind: "opened",
        date: "1819",
        endDate: null,
        continuing: false,
        name: null,
        title: null,
        text: null,
        newOwnerName: null,
        citations: [
          {
            sourceId: "wp",
            statedValue: "1819",
            quote: "Brora distillery was founded in 1819.",
          },
        ],
      },
      {
        id: 2,
        kind: "closed",
        date: "1983",
        endDate: null,
        continuing: false,
        name: null,
        title: null,
        text: null,
        newOwnerName: null,
        citations: [
          {
            sourceId: "wp",
            statedValue: "1983",
            quote: "Production at Brora was stopped in early 1983.",
          },
        ],
      },
    ],
    siteFacts: [],
    sections: [{ key: "lead", heading: null, eraEventId: null, sentences }],
  };
}

const goodDraft = draft([
  { text: "Brora opened in 1819.", factIds: ["event:1"] },
  { text: "It closed in 1983.", factIds: ["event:2"] },
]);

function services(writer: EntityAboutWriter) {
  return {
    enabled: true,
    writer: vi.fn(writer),
    now: () => new Date("2026-10-23T12:00:00Z"),
  };
}

describe("writeEntityAbout", () => {
  test("saves a draft that passes every check", async ({ fixtures }) => {
    const entity = await fixtures.Entity({
      kind: "distillery",
      description: "An unsourced description.",
      descriptionSrc: "generated",
    });

    const result = await writeEntityAbout(
      { entityId: entity.id },
      services(async () => ({ draft: goodDraft, pagesRead: [page] })),
    );

    expect(result).toEqual({ status: "saved", version: 1 });
    const about = await getEntityAbout(db, entity.id);
    expect(about?.checkedOn).toBe("2026-10-23");
    expect(about?.document.events.map(({ writtenBy }) => writtenBy)).toEqual([
      "pipeline",
      "pipeline",
    ]);
    const [saved] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, entity.id));
    expect(saved?.description).toBe("Brora opened in 1819. It closed in 1983.");
  });

  test("keeps a description a person wrote", async ({ fixtures }) => {
    const entity = await fixtures.Entity({
      kind: "distillery",
      description: "Written by a moderator.",
      descriptionSrc: "user",
    });

    await writeEntityAbout(
      { entityId: entity.id },
      services(async () => ({ draft: goodDraft, pagesRead: [page] })),
    );

    const [saved] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, entity.id));
    expect(saved?.description).toBe("Written by a moderator.");
  });

  test("keeps descriptions it did not write", async ({ fixtures }) => {
    // Unknown origin: written before descriptions recorded who wrote them.
    const unknown = await fixtures.Entity({
      kind: "distillery",
      description: "An older description.",
      descriptionSrc: null,
    });
    // A hidden page never feeds the public description.
    const hidden = await fixtures.Entity({ kind: "distillery" });
    await fixtures.EntityAbout({ entityId: hidden.id, status: "hidden" });

    for (const entity of [unknown, hidden]) {
      await writeEntityAbout(
        { entityId: entity.id },
        services(async () => ({ draft: goodDraft, pagesRead: [page] })),
      );
    }

    const rows = await db
      .select({ id: entities.id, description: entities.description })
      .from(entities);
    const byId = new Map(rows.map((row) => [row.id, row.description]));
    expect(byId.get(unknown.id)).toBe("An older description.");
    expect(byId.get(hidden.id)).toBe(hidden.description);
  });

  test("fills an empty description", async ({ fixtures }) => {
    const entity = await fixtures.Entity({
      kind: "distillery",
      description: "",
      descriptionSrc: null,
    });

    await writeEntityAbout(
      { entityId: entity.id },
      services(async () => ({ draft: goodDraft, pagesRead: [page] })),
    );

    const [saved] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, entity.id));
    expect(saved?.description).toBe("Brora opened in 1819. It closed in 1983.");
  });

  test("keeps a description a person writes during the run", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      kind: "distillery",
      description: "An unsourced description.",
      descriptionSrc: "generated",
    });
    const run = services(async () => {
      await db
        .update(entities)
        .set({ description: "Written by a moderator.", descriptionSrc: "user" })
        .where(eq(entities.id, entity.id));
      return { draft: goodDraft, pagesRead: [page] };
    });

    await writeEntityAbout({ entityId: entity.id }, run);

    const [saved] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, entity.id));
    expect(saved?.description).toBe("Written by a moderator.");
  });

  test("retries once with the failures, then saves nothing", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ kind: "distillery" });
    const filler = draft([
      { text: "Brora has a rich history.", factIds: [] },
      { text: "It closed in 1983.", factIds: ["event:2"] },
    ]);
    const writer = services(async () => ({ draft: filler, pagesRead: [page] }));

    const result = await writeEntityAbout({ entityId: entity.id }, writer);

    expect(result).toMatchObject({ status: "rejected" });
    expect(writer.writer).toHaveBeenCalledTimes(2);
    expect(writer.writer.mock.calls[1]?.[0].previousErrors).toEqual([
      '"Brora has a rich history." (lead) cites no facts.',
    ]);
    expect(await getEntityAbout(db, entity.id)).toBeNull();
  });

  test("tells the writer which items break the output format", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ kind: "distillery" });
    const tooLong = structuredClone(goodDraft);
    tooLong.events[0]!.citations[0]!.quote = "x".repeat(301);
    const writer = services(async () => ({
      draft: tooLong,
      pagesRead: [page],
    }));

    await writeEntityAbout({ entityId: entity.id }, writer);

    expect(writer.writer.mock.calls[1]?.[0].previousErrors?.[0]).toMatch(
      /^The event 1 does not match the output format at citations\.0\.quote:/,
    );
  });

  test("drops facts whose quotes are not on a page it read", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ kind: "distillery" });
    const unread = { ...page, text: "Brora distillery was founded in 1819." };

    const result = await writeEntityAbout(
      { entityId: entity.id },
      services(async () => ({
        draft: draft([{ text: "Brora opened in 1819.", factIds: ["event:1"] }]),
        pagesRead: [unread],
      })),
    );

    // One fact is left, too few for prose, so the lead fails the checks.
    expect(result).toMatchObject({ status: "rejected" });
  });

  test("keeps items a person wrote", async ({ fixtures }) => {
    const entity = await fixtures.Entity({ kind: "distillery" });
    await fixtures.EntityAbout({
      entityId: entity.id,
      events: [{ id: 1, kind: "closed", date: "1983-03", writtenBy: "person" }],
    });

    await writeEntityAbout(
      { entityId: entity.id },
      services(async () => ({ draft: goodDraft, pagesRead: [page] })),
    );

    const about = await getEntityAbout(db, entity.id);
    expect(
      about?.document.events.map(({ kind, date, writtenBy }) => [
        kind,
        date,
        writtenBy,
      ]),
    ).toEqual([
      // The draft's 1983 closing agrees with the person's, so it adds a
      // source instead of a second event.
      ["closed", "1983-03", "person"],
      ["opened", "1819", "pipeline"],
    ]);
  });

  test("asks the writer to source stored history", async ({ fixtures }) => {
    const entity = await fixtures.Entity({ kind: "distillery" });
    await fixtures.EntityAbout({
      entityId: entity.id,
      sources: [],
      events: [
        {
          id: 5,
          kind: "opened",
          date: "1819",
          text: "Built by the Sutherland estate.",
          writtenBy: "pipeline",
          citations: [],
        },
      ],
    });
    const run = services(async () => ({ draft: goodDraft, pagesRead: [page] }));

    await writeEntityAbout({ entityId: entity.id }, run);

    expect(run.writer.mock.calls[0]?.[0].unsourcedHistory).toEqual([
      "#5 opened, 1819: Built by the Sutherland estate.",
    ]);
    const about = await getEntityAbout(db, entity.id);
    expect(
      about?.document.events.map(({ id, text, citations }) => [
        id,
        text,
        citations.length,
      ]),
    ).toEqual([
      [5, "Built by the Sutherland estate.", 1],
      [2, null, 1],
    ]);
  });

  test("asks the writer to check the facts it replaces", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ kind: "distillery" });
    await fixtures.EntityAbout({
      entityId: entity.id,
      events: [
        { id: 1, kind: "opened", date: "1819", writtenBy: "pipeline" },
        // A person's fact stays either way, so it is not listed.
        { id: 2, kind: "closed", date: "1983", writtenBy: "person" },
      ],
    });
    const run = services(async () => ({ draft: goodDraft, pagesRead: [page] }));

    await writeEntityAbout({ entityId: entity.id }, run);

    expect(run.writer.mock.calls[0]?.[0].shownFacts).toEqual([
      "#1 opened, 1819 (found on https://example.com/history)",
    ]);
  });

  test("drops site facts that do not apply to the kind", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ kind: "brand" });
    const withStills: AboutDraft = {
      ...goodDraft,
      siteFacts: [
        {
          field: "washStills",
          value: 1,
          asOf: null,
          citations: [
            {
              sourceId: "wp",
              statedValue: "1",
              quote: "It has 1 wash still.",
            },
          ],
        },
      ],
    };

    const result = await writeEntityAbout(
      { entityId: entity.id },
      services(async () => ({ draft: withStills, pagesRead: [page] })),
    );

    expect(result).toMatchObject({ status: "saved" });
    const about = await getEntityAbout(db, entity.id);
    expect(about?.document.siteFacts).toEqual({});
  });

  test("saves nothing when the stored page breaks a store rule", async ({
    fixtures,
  }) => {
    // A person's site fact stays after the Entity becomes a brand, so the
    // store rejects every save until a moderator removes it.
    const entity = await fixtures.Entity({ kind: "brand" });
    await fixtures.EntityAbout({
      entityId: entity.id,
      siteFacts: {
        washStills: {
          value: 1,
          asOf: null,
          citations: [{ sourceId: "s1", statedValue: "1", quote: null }],
          writtenBy: "person",
        },
      },
    });

    const result = await writeEntityAbout(
      { entityId: entity.id },
      services(async () => ({ draft: goodDraft, pagesRead: [page] })),
    );

    expect(result.status).toBe("rejected");
    expect((await getEntityAbout(db, entity.id))?.version).toBe(1);
  });

  test("retries a draft the store would reject", async ({ fixtures }) => {
    const entity = await fixtures.Entity({ kind: "distillery" });
    const missingEra: AboutDraft = {
      ...goodDraft,
      sections: [{ ...goodDraft.sections[0]!, eraEventId: 99 }],
    };
    const run = services(async () => ({
      draft: missingEra,
      pagesRead: [page],
    }));

    const result = await writeEntityAbout({ entityId: entity.id }, run);

    expect(result).toMatchObject({ status: "rejected" });
    expect(run.writer).toHaveBeenCalledTimes(2);
    expect(await getEntityAbout(db, entity.id)).toBeNull();
  });

  test("never saves a draft that shows fewer facts", async ({ fixtures }) => {
    const entity = await fixtures.Entity({ kind: "distillery" });
    await fixtures.EntityAbout({
      entityId: entity.id,
      events: [
        { id: 1, kind: "opened", date: "1819", writtenBy: "pipeline" },
        { id: 2, kind: "closed", date: "1983", writtenBy: "pipeline" },
        { id: 3, kind: "reopened", date: "2021", writtenBy: "pipeline" },
      ],
    });

    const result = await writeEntityAbout(
      { entityId: entity.id },
      services(async () => ({ draft: goodDraft, pagesRead: [page] })),
    );

    expect(result).toMatchObject({ status: "rejected" });
    const about = await getEntityAbout(db, entity.id);
    expect(about?.document.events.map(({ id }) => id)).toEqual([1, 2, 3]);
  });

  test("rejects prose that contradicts a person's fact", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ kind: "distillery" });
    await fixtures.EntityAbout({
      entityId: entity.id,
      siteFacts: {
        washStills: {
          value: 2,
          asOf: null,
          citations: [{ sourceId: "s1", statedValue: "2", quote: null }],
          writtenBy: "person",
        },
      },
    });
    const oneStill: AboutDraft = {
      ...goodDraft,
      siteFacts: [
        {
          field: "washStills",
          value: 1,
          asOf: null,
          citations: [
            {
              sourceId: "wp",
              statedValue: "1",
              quote: "It has 1 wash still.",
            },
          ],
        },
      ],
      sections: [
        {
          ...goodDraft.sections[0]!,
          sentences: [
            ...goodDraft.sections[0]!.sentences,
            { text: "It has 1 wash still.", factIds: ["site:washStills"] },
          ],
        },
      ],
    };
    const run = services(async () => ({ draft: oneStill, pagesRead: [page] }));

    const result = await writeEntityAbout({ entityId: entity.id }, run);

    expect(result).toMatchObject({ status: "rejected" });
    expect(run.writer).toHaveBeenCalledTimes(2);
    const about = await getEntityAbout(db, entity.id);
    expect(about?.document.siteFacts.washStills?.value).toBe(2);
  });

  test("never removes the page's lead", async ({ fixtures }) => {
    const entity = await fixtures.Entity({ kind: "distillery" });
    await fixtures.EntityAbout({
      entityId: entity.id,
      events: [
        { id: 1, kind: "opened", date: "1819", writtenBy: "pipeline" },
        { id: 2, kind: "closed", date: "1983", writtenBy: "pipeline" },
      ],
      sections: [
        {
          key: "lead",
          heading: null,
          eraEventId: null,
          writtenBy: "pipeline",
          sentences: [{ text: "It opened in 1819.", factIds: ["event:1"] }],
        },
      ],
    });
    const noProse: AboutDraft = { ...goodDraft, sections: [] };

    const result = await writeEntityAbout(
      { entityId: entity.id },
      services(async () => ({ draft: noProse, pagesRead: [page] })),
    );

    expect(result).toMatchObject({ status: "rejected" });
    const about = await getEntityAbout(db, entity.id);
    expect(about?.document.sections.map(({ key }) => key)).toEqual(["lead"]);
  });

  test("saves nothing from an empty draft", async ({ fixtures }) => {
    const entity = await fixtures.Entity({ kind: "distillery" });
    const empty: AboutDraft = {
      sources: [],
      events: [],
      siteFacts: [],
      sections: [],
    };

    const result = await writeEntityAbout(
      { entityId: entity.id },
      services(async () => ({ draft: empty, pagesRead: [] })),
    );

    expect(result).toMatchObject({ status: "rejected" });
    expect(await getEntityAbout(db, entity.id)).toBeNull();
  });

  test("does nothing while turned off", async ({ fixtures }) => {
    const entity = await fixtures.Entity({ kind: "distillery" });
    const writer = {
      ...services(async () => ({ draft: goodDraft, pagesRead: [] })),
      enabled: false,
    };

    expect(await writeEntityAbout({ entityId: entity.id }, writer)).toEqual({
      status: "disabled",
    });
    expect(writer.writer).not.toHaveBeenCalled();
  });

  test("skips kinds without About pages", async ({ fixtures }) => {
    const entity = await fixtures.Entity({ kind: "bottler" });

    expect(
      await writeEntityAbout(
        { entityId: entity.id },
        services(async () => ({ draft: goodDraft, pagesRead: [page] })),
      ),
    ).toEqual({ status: "skipped" });
  });
});
