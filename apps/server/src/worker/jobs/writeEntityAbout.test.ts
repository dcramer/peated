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
  text: "Brora distillery was founded in 1819. Production at Brora was stopped in early 1983.",
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
      ["closed", "1983-03", "person"],
      ["opened", "1819", "pipeline"],
      ["closed", "1983", "pipeline"],
    ]);
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
