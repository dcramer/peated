import type { AboutDraft } from "@peated/server/agents/entityAbout/draftSchema";
import type { EntityAboutWriter } from "@peated/server/agents/entityAbout/writer";
import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { getEntityAbout } from "@peated/server/lib/entityAbout/store";
import { routerClient } from "@peated/server/orpc/router";
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
        newOwnerId: null,
        relatedEntityId: null,
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
        newOwnerId: null,
        relatedEntityId: null,
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
    expect(about?.document.events.map(({ id }) => id)).toEqual([1, 2]);
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

  test("on its last try, leaves out sentences citing a dropped fact", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ kind: "distillery" });
    const withGap = draft([
      { text: "Brora opened in 1819.", factIds: ["event:1"] },
      { text: "It closed in 1983.", factIds: ["event:2"] },
      { text: "It reopened in 2021.", factIds: ["event:3"] },
    ]);
    const writer = services(async () => ({
      draft: withGap,
      pagesRead: [page],
    }));

    const result = await writeEntityAbout({ entityId: entity.id }, writer);

    expect(result).toMatchObject({ status: "saved" });
    expect(writer.writer).toHaveBeenCalledTimes(2);
    const saved = await getEntityAbout(db, entity.id);
    expect(
      saved?.document.sections.flatMap((section) =>
        section.sentences.map((sentence) => sentence.text),
      ),
    ).toEqual(["Brora opened in 1819.", "It closed in 1983."]);
  });

  test("on its last try, trims prose longer than its facts allow", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ kind: "distillery" });
    const tooLong = draft([
      { text: "Brora opened in 1819.", factIds: ["event:1"] },
      { text: "It closed in 1983.", factIds: ["event:2"] },
      { text: "It was open for 164 years.", factIds: ["event:1", "event:2"] },
    ]);
    const writer = services(async () => ({
      draft: tooLong,
      pagesRead: [page],
    }));

    const result = await writeEntityAbout({ entityId: entity.id }, writer);

    expect(result).toMatchObject({ status: "saved" });
    const saved = await getEntityAbout(db, entity.id);
    expect(
      saved?.document.sections.flatMap((section) =>
        section.sentences.map((sentence) => sentence.text),
      ),
    ).toEqual(["Brora opened in 1819.", "It closed in 1983."]);
  });

  test("saves nothing when leaving out sentences removes the lead", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ kind: "distillery" });
    const noLead = draft([
      { text: "It reopened in 2021.", factIds: ["event:3"] },
      { text: "It was renamed in 1969.", factIds: ["event:4"] },
    ]);
    const writer = services(async () => ({ draft: noLead, pagesRead: [page] }));

    const result = await writeEntityAbout({ entityId: entity.id }, writer);

    expect(result).toMatchObject({ status: "rejected" });
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

  test("gives the writer its notes, history, and current page", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({ kind: "distillery" });
    await fixtures.EntityEvent({
      entityId: entity.id,
      kind: "closed",
      date: "1983",
      sourceUrl: "https://example.com/closing",
    });
    await routerClient.entities.about.notes.create(
      { entity: entity.id, text: "Not the modern Clynelish next door." },
      { context: { user } },
    );
    await fixtures.EntityAbout({
      entityId: entity.id,
      events: [{ id: 1, kind: "opened", date: "1819" }],
    });
    const run = services(async () => ({ draft: goodDraft, pagesRead: [page] }));

    await writeEntityAbout({ entityId: entity.id }, run);

    const input = run.writer.mock.calls[0]![0];
    expect(input.notes).toEqual(["Not the modern Clynelish next door."]);
    expect(input.history).toEqual([
      "closed, 1983; source https://example.com/closing",
    ]);
    expect(input.currentPage?.events.map(({ id }) => id)).toEqual([1]);
  });

  test("replaces the whole page with the writer's next version", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ kind: "distillery" });
    await fixtures.EntityAbout({
      entityId: entity.id,
      events: [{ id: 7, kind: "mothballed", date: "1931" }],
    });

    const result = await writeEntityAbout(
      { entityId: entity.id },
      services(async () => ({ draft: goodDraft, pagesRead: [page] })),
    );

    expect(result).toEqual({ status: "saved", version: 2 });
    const about = await getEntityAbout(db, entity.id);
    expect(about?.document.events.map(({ id }) => id)).toEqual([1, 2]);
  });

  test("keeps a citation from the current page without a read", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ kind: "distillery" });

    await writeEntityAbout(
      { entityId: entity.id },
      services(async () => ({ draft: goodDraft, pagesRead: [page] })),
    );
    // The next run reads no pages and returns the page as it is.
    const result = await writeEntityAbout(
      { entityId: entity.id },
      services(async ({ currentPage }) => ({
        draft: currentPage!,
        pagesRead: [],
      })),
    );

    expect(result).toEqual({ status: "saved", version: 2 });
  });

  test("links an owner only by an ID Entity search returned", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ kind: "distillery" });
    const owner = await fixtures.Entity({
      name: "Distillers Company",
      kind: "company",
    });
    const other = await fixtures.Entity({ kind: "company" });
    const acquiredPage = {
      url: page.url,
      text: `${page.text} The Distillers Company bought it in 1925.`,
    };
    const acquired = (newOwnerId: number): AboutDraft => ({
      ...goodDraft,
      events: [
        ...goodDraft.events,
        {
          id: 3,
          kind: "acquired",
          date: "1925",
          endDate: null,
          continuing: false,
          name: null,
          title: null,
          text: null,
          newOwnerName: "Distillers Company",
          newOwnerId,
          relatedEntityId: null,
          citations: [
            {
              sourceId: "wp",
              statedValue: "1925",
              quote: "The Distillers Company bought it in 1925.",
            },
          ],
        },
      ],
    });
    const ownerOf = async () =>
      (await getEntityAbout(db, entity.id))?.document.events.find(
        ({ id }) => id === 3,
      );

    // An ID no search returned is cleared; the name stays.
    await writeEntityAbout(
      { entityId: entity.id },
      services(async () => ({
        draft: acquired(other.id),
        pagesRead: [acquiredPage],
        entitiesFound: [owner.id],
      })),
    );
    expect(await ownerOf()).toMatchObject({
      newOwnerName: "Distillers Company",
      newOwnerId: null,
    });

    await writeEntityAbout(
      { entityId: entity.id },
      services(async () => ({
        draft: acquired(owner.id),
        pagesRead: [acquiredPage],
        entitiesFound: [owner.id],
      })),
    );
    expect(await ownerOf()).toMatchObject({ newOwnerId: owner.id });

    // A link the current page has carries over without a new search.
    await writeEntityAbout(
      { entityId: entity.id },
      services(async () => ({
        draft: acquired(owner.id),
        pagesRead: [acquiredPage],
      })),
    );
    expect(await ownerOf()).toMatchObject({ newOwnerId: owner.id });
  });

  test.for(["brand", "bottler", "company"] as const)(
    "saves a %s page without site facts",
    async (kind, { fixtures }) => {
      const entity = await fixtures.Entity({ kind });
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
    },
  );

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

  test("skips an Entity deleted during the run", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const entity = await fixtures.Entity({ kind: "distillery" });

    const result = await writeEntityAbout(
      { entityId: entity.id },
      services(async () => {
        await routerClient.entities.delete(
          { entity: entity.id },
          { context: { user: admin } },
        );
        return { draft: goodDraft, pagesRead: [page] };
      }),
    );

    expect(result).toEqual({ status: "skipped" });
    expect(await getEntityAbout(db, entity.id)).toBeNull();
  });

  test("keeps a moderator's edit saved during the run", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({ kind: "distillery" });
    await fixtures.EntityAbout({ entityId: entity.id, events: [{ id: 1 }] });
    const before = await getEntityAbout(db, entity.id);

    const result = await writeEntityAbout(
      { entityId: entity.id },
      services(async () => {
        await routerClient.entities.about.update(
          { entity: entity.id, version: 1, document: before!.document },
          { context: { user: mod } },
        );
        return { draft: goodDraft, pagesRead: [page] };
      }),
    );

    expect(result).toEqual({ status: "skipped" });
    expect((await getEntityAbout(db, entity.id))?.version).toBe(2);
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
});
