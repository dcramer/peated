import { EntityAboutDocumentSchema } from "@peated/server/schemas/entityAbout";

import { mergePipelineDraft } from "./document";

const now = "2026-10-23T00:00:00.000Z";

function document(input: object) {
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
        // Repeats the person's event, so it is dropped.
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

    const merged = mergePipelineDraft(stored, draft, now);

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
});
