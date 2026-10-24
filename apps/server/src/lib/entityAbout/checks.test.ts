import {
  EntityAboutDocumentSchema,
  type EntityAboutDocument,
} from "@peated/server/schemas/entityAbout";
import type { z } from "zod";

import {
  checkAboutProse,
  checkConflictPicks,
  keepVerifiedCitations,
} from "./checks";

const source = {
  id: "wp",
  url: "https://en.wikipedia.org/wiki/Brora_distillery",
  title: "Brora distillery",
  kind: "reference" as const,
};

function draft(
  input: Partial<z.input<typeof EntityAboutDocumentSchema>>,
): EntityAboutDocument {
  return EntityAboutDocumentSchema.parse({ sources: [source], ...input });
}

function event(id: number, date: string, quote: string) {
  return {
    id,
    kind: "closed" as const,
    date,
    writtenBy: "pipeline" as const,
    citations: [{ sourceId: "wp", statedValue: date, quote }],
  };
}

const page = {
  url: "https://en.wikipedia.org/wiki/Brora_distillery",
  text: "Brora closed in 1983. It was rebuilt in 2021 after 38 years.",
};

describe("keepVerifiedCitations", () => {
  test("keeps quotes found on a page read in the run", () => {
    const result = keepVerifiedCitations(
      draft({ events: [event(1, "1983", "Brora closed in 1983.")] }),
      [page],
    );

    expect(result.events).toHaveLength(1);
  });

  test("drops a fact whose quote is not on the page", () => {
    const result = keepVerifiedCitations(
      draft({ events: [event(1, "1985", "Brora closed in 1985.")] }),
      [page],
    );

    expect(result.events).toEqual([]);
    expect(result.sources).toEqual([]);
  });

  test("drops a fact whose quote does not state its date", () => {
    const result = keepVerifiedCitations(
      draft({
        events: [
          // A real quote, but it says 1983, not 1984.
          {
            ...event(1, "1984", "Brora closed in 1983."),
            citations: [
              {
                sourceId: "wp",
                statedValue: null,
                quote: "Brora closed in 1983.",
              },
            ],
          },
          // The stated value is not in the quote.
          event(2, "1984", "It was rebuilt in 2021 after 38 years."),
        ],
      }),
      [page],
    );

    expect(result.events).toEqual([]);
  });

  test("ignores case, quote marks, and punctuation", () => {
    const result = keepVerifiedCitations(
      draft({ events: [event(1, "2021", "rebuilt in 2021, after 38 years")] }),
      [page],
    );

    expect(result.events).toHaveLength(1);
  });
});

describe("checkAboutProse", () => {
  const facts = [
    event(1, "1983", "Brora closed in 1983."),
    event(2, "2021", "rebuilt in 2021"),
  ];
  const lead = (sentences: { text: string; factIds: string[] }[]) => [
    { key: "lead", writtenBy: "pipeline" as const, sentences },
  ];

  test("accepts sentences that state their facts", () => {
    expect(
      checkAboutProse(
        draft({
          events: facts,
          sections: lead([
            { text: "It closed in 1983.", factIds: ["event:1"] },
            { text: "It was rebuilt in 2021.", factIds: ["event:2"] },
          ]),
        }),
      ),
    ).toEqual([]);
  });

  test("rejects filler, wrong numbers, and banned phrases", () => {
    const errors = checkAboutProse(
      draft({
        events: facts,
        sections: lead([
          { text: "It has a rich history.", factIds: [] },
          { text: "It closed in 1985.", factIds: ["event:1"] },
        ]),
      }),
    );

    expect(errors).toEqual([
      '"It has a rich history." (lead) cites no facts.',
      '"It closed in 1985." (lead) states 1985, which its facts do not.',
    ]);
  });

  test("rejects a stock phrase", () => {
    expect(
      checkAboutProse(
        draft({
          events: facts,
          sections: lead([
            { text: "The iconic site closed in 1983.", factIds: ["event:1"] },
          ]),
        }),
      ),
    ).toEqual([
      '"The iconic site closed in 1983." (lead) uses the banned phrase "iconic".',
    ]);
  });

  test("allows no prose with fewer than 2 shown facts", () => {
    expect(
      checkAboutProse(
        draft({
          events: [facts[0]],
          sections: lead([
            { text: "It closed in 1983.", factIds: ["event:1"] },
          ]),
        }),
      ),
    ).toEqual(["Only 1 facts are shown; prose needs at least 2."]);
  });

  test("allows no sections beyond the lead with fewer than 6 shown facts", () => {
    const errors = checkAboutProse(
      draft({
        events: facts,
        sections: [
          ...lead([{ text: "It closed in 1983.", factIds: ["event:1"] }]),
          {
            key: "history",
            heading: "History",
            writtenBy: "pipeline" as const,
            sentences: [
              { text: "It was rebuilt in 2021.", factIds: ["event:2"] },
            ],
          },
        ],
      }),
    );

    expect(errors).toEqual([
      "Only 2 facts are shown; sections beyond the lead need at least 6.",
    ]);
  });
});

describe("checkConflictPicks", () => {
  test("requires the stored value to be one a source states", () => {
    const document = draft({
      sources: [
        source,
        { ...source, id: "df", url: "https://www.diffordsguide.com/brora" },
      ],
      events: [
        {
          id: 1,
          kind: "renamed",
          name: "Brora",
          date: "1970",
          writtenBy: "pipeline",
          citations: [
            { sourceId: "wp", statedValue: "1968" },
            { sourceId: "df", statedValue: "1969" },
          ],
        },
      ],
    });

    expect(checkConflictPicks(document)).toEqual([
      "Event 1 stores 1970, which no source states.",
    ]);
  });
});
