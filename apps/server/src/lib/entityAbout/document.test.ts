import { EntityAboutDocumentSchema } from "@peated/server/schemas/entityAbout";
import type { z } from "zod";

import { mergePipelineDraft } from "./document";

const now = "2026-10-23T00:00:00.000Z";

function document(input: Partial<z.input<typeof EntityAboutDocumentSchema>>) {
  return EntityAboutDocumentSchema.parse({
    sources: [
      {
        id: "s1",
        url: "https://example.com/history",
        title: "History",
        kind: "reference",
      },
    ],
    ...input,
  });
}

const cited = [{ sourceId: "s1" }];

describe("mergePipelineDraft", () => {
  test("keeps a person's items and replaces the pipeline's", () => {
    const stored = document({
      events: [
        {
          id: 1,
          kind: "closed",
          date: "1983-03",
          writtenBy: "person",
          citations: cited,
        },
        {
          id: 2,
          kind: "opened",
          date: "1819",
          writtenBy: "pipeline",
          citations: cited,
        },
      ],
      sections: [
        {
          key: "lead",
          writtenBy: "person",
          sentences: [
            { text: "It closed in March 1983.", factIds: ["event:1"] },
          ],
        },
      ],
    });
    const draft = document({
      events: [
        // Repeats the person's event, so only its citations are kept.
        {
          id: 1,
          kind: "closed",
          date: "1983-03",
          writtenBy: "pipeline",
          citations: cited,
        },
        {
          id: 2,
          kind: "opened",
          date: "1820",
          writtenBy: "pipeline",
          citations: cited,
        },
      ],
      sections: [
        {
          key: "lead",
          writtenBy: "pipeline",
          sentences: [{ text: "It opened in 1820.", factIds: ["event:2"] }],
        },
        {
          key: "history",
          writtenBy: "pipeline",
          sentences: [{ text: "It opened in 1820.", factIds: ["event:2"] }],
        },
      ],
    });

    const merged = mergePipelineDraft(stored, draft, now, new Map());

    expect(
      merged.events.map(({ kind, date, writtenBy }) => [kind, date, writtenBy]),
    ).toEqual([
      ["closed", "1983-03", "person"],
      ["opened", "1820", "pipeline"],
    ]);
    // The person's lead stays; the pipeline's other section is added with
    // its fact IDs renumbered to the merged events.
    const openedId = merged.events[1]!.id;
    expect(
      merged.sections.map(({ key, writtenBy }) => [key, writtenBy]),
    ).toEqual([
      ["lead", "person"],
      ["history", "pipeline"],
    ]);
    expect(merged.sections[1]?.sentences[0]?.factIds).toEqual([
      `event:${openedId}`,
    ]);
  });

  test("adds draft citations to kept history instead of repeating it", () => {
    const stored = document({
      sources: [],
      events: [
        // Legacy history with no source, written by the system.
        { id: 7, kind: "opened", date: "1819", writtenBy: "pipeline" },
        { id: 8, kind: "closed", date: "1931", writtenBy: "pipeline" },
      ],
    });
    const draft = document({
      events: [
        {
          id: 1,
          kind: "opened",
          date: "1819-05",
          writtenBy: "pipeline",
          citations: [{ sourceId: "s1", statedValue: "1819" }],
        },
      ],
      sections: [
        {
          key: "lead",
          writtenBy: "pipeline",
          sentences: [{ text: "It opened in 1819.", factIds: ["event:1"] }],
        },
      ],
    });

    const merged = mergePipelineDraft(stored, draft, now, new Map());

    expect(
      merged.events.map(({ id, date, citations }) => [
        id,
        date,
        citations.map((c) => c.sourceId),
      ]),
    ).toEqual([
      // The stored date stays; the draft's source is added.
      [7, "1819", ["s1"]],
      // History nobody could source stays stored, and hidden.
      [8, "1931", []],
    ]);
    expect(merged.sections[0]?.sentences[0]?.factIds).toEqual(["event:7"]);
  });

  test("keeps pipeline facts that a person's section cites", () => {
    const stored = document({
      events: [
        {
          id: 3,
          kind: "closed",
          date: "1983",
          writtenBy: "pipeline",
          citations: cited,
        },
      ],
      siteFacts: {
        washStills: { value: 1, writtenBy: "pipeline", citations: cited },
      },
      sections: [
        {
          key: "lead",
          writtenBy: "person",
          sentences: [
            { text: "It closed in 1983.", factIds: ["event:3"] },
            { text: "It has 1 wash still.", factIds: ["site:washStills"] },
          ],
        },
      ],
    });
    const draft = document({
      events: [
        {
          id: 3,
          kind: "opened",
          date: "1819",
          writtenBy: "pipeline",
          citations: cited,
        },
      ],
      // A new value would contradict the person's sentence.
      siteFacts: {
        washStills: { value: 2, writtenBy: "pipeline", citations: cited },
      },
    });

    const merged = mergePipelineDraft(stored, draft, now, new Map());

    expect(merged.events.map(({ id, kind }) => [id, kind])).toEqual([
      [3, "closed"],
      // Renumbered, so the person's sentence still cites the closing.
      [4, "opened"],
    ]);
    expect(merged.sections[0]?.sentences[0]?.factIds).toEqual(["event:3"]);
    expect(merged.siteFacts.washStills?.value).toBe(1);
  });

  test("keeps different events from the same year apart", () => {
    const stored = document({
      sources: [],
      events: [
        {
          id: 7,
          kind: "generic",
          date: "1961",
          text: "The stills switched to steam.",
          writtenBy: "pipeline",
        },
        {
          id: 8,
          kind: "acquired",
          date: "1925",
          newOwnerName: "DCL",
          writtenBy: "pipeline",
        },
        // A person's acquisition with only an owner ID; its name is unknown.
        {
          id: 9,
          kind: "acquired",
          date: "1925",
          newOwnerId: 42,
          writtenBy: "person",
          citations: cited,
        },
      ],
    });
    const draft = document({
      events: [
        {
          id: 1,
          kind: "generic",
          date: "1961",
          text: "A new warehouse was built.",
          writtenBy: "pipeline",
          citations: cited,
        },
        {
          id: 2,
          kind: "acquired",
          date: "1925",
          newOwnerName: "John Risk",
          writtenBy: "pipeline",
          citations: cited,
        },
        // Reuses the listed item's ID, so it sources that item.
        {
          id: 7,
          kind: "generic",
          date: "1961",
          text: "Coal fires gave way to steam.",
          writtenBy: "pipeline",
          citations: cited,
        },
      ],
    });

    const merged = mergePipelineDraft(stored, draft, now, new Map());

    expect(
      merged.events.map(({ id, text, newOwnerName, citations }) => [
        id,
        text ?? newOwnerName,
        citations.length,
      ]),
    ).toEqual([
      [7, "The stills switched to steam.", 1],
      [8, "DCL", 0],
      [9, null, 1],
      [1, "A new warehouse was built.", 1],
      [2, "John Risk", 1],
    ]);
  });

  test("matches a linked owner by its name", () => {
    const stored = document({
      events: [
        {
          id: 4,
          kind: "acquired",
          date: "1925",
          newOwnerId: 42,
          writtenBy: "person",
          citations: cited,
        },
      ],
    });
    const draft = document({
      events: [
        {
          id: 1,
          kind: "acquired",
          date: "1925",
          newOwnerName: "Distillers Company",
          writtenBy: "pipeline",
          citations: [{ sourceId: "s1", statedValue: "1925" }],
        },
      ],
    });

    const merged = mergePipelineDraft(
      stored,
      draft,
      now,
      new Map([[42, "Distillers Company"]]),
    );

    expect(merged.events.map(({ id }) => id)).toEqual([4]);
  });
});
