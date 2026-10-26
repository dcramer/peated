import {
  EntityAboutDocumentSchema,
  type EntityAboutDocument,
} from "@peated/server/schemas/entityAbout";
import type { z } from "zod";

import {
  checkAboutProse,
  checkConflictPicks,
  keepVerifiedCitations,
  reviewAboutDraft,
} from "./checks";
import { getDateDisagreement, getDisagreement, valuesAgree } from "./display";
import { toPublicEntityAbout } from "./publicAbout";

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
      null,
    );

    expect(result.events).toHaveLength(1);
  });

  test("drops a fact whose quote is not on the page", () => {
    const result = keepVerifiedCitations(
      draft({ events: [event(1, "1985", "Brora closed in 1985.")] }),
      [page],
      null,
    );

    expect(result.events).toEqual([]);
    expect(result.sources).toEqual([]);

    // A quote is whole words from the page, not part of one.
    expect(
      keepVerifiedCitations(
        draft({ events: [event(1, "1983", "ra closed in 1983.")] }),
        [page],
        null,
      ).events,
    ).toEqual([]);
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
      null,
    );

    expect(result.events).toEqual([]);
  });

  test("drops an event whose text states a number no quote states", () => {
    const withText = (text: string) =>
      keepVerifiedCitations(
        draft({
          events: [
            {
              ...event(1, "2021", "It was rebuilt in 2021 after 38 years."),
              kind: "generic",
              text,
            },
          ],
        }),
        [page],
        null,
      ).events.length;

    expect(withText("Brora was rebuilt after 38 years.")).toBe(1);
    expect(withText("Brora was rebuilt with 4 stills.")).toBe(0);
  });

  test("counts a publication date only when its year is on the page", () => {
    // The quote has no year; only the article's date can date the event.
    const kept = (date: string) =>
      keepVerifiedCitations(
        draft({
          sources: [{ ...source, publishedOn: `${date}-05-19` }],
          events: [
            {
              id: 1,
              kind: "generic",
              date,
              text: "Brora closed.",
              citations: [
                { sourceId: "wp", statedValue: null, quote: "Brora closed" },
              ],
            },
          ],
        }),
        [page],
        null,
      ).events.length;

    // 2021 is on the page; 2024 is not, so a claimed 2024 date is no evidence.
    expect(kept("2021")).toBe(1);
    expect(kept("2024")).toBe(0);
  });

  test("drops an event whose text has a number word no quote states", () => {
    const kept = (text: string, quote: string) =>
      keepVerifiedCitations(
        draft({
          events: [
            {
              id: 1,
              kind: "generic",
              date: "1983",
              text,
              citations: [{ sourceId: "wp", statedValue: "1983", quote }],
            },
          ],
        }),
        [{ ...page, text: `${page.text} ${quote}` }],
        null,
      ).events.length;

    expect(
      kept("Brora closed with four stills.", "Brora closed in 1983."),
    ).toBe(0);
    expect(
      kept(
        "Brora closed with four stills.",
        "In 1983 its four stills fell silent.",
      ),
    ).toBe(1);
    // "1.6 million" in text and "1.6m" in a quote are the same number.
    expect(
      kept("Brora made 1.6 million litres.", "In 1983 it made 1.6m litres."),
    ).toBe(1);
    expect(
      kept("Diageo paid 1.2 billion.", "In 1983 Diageo paid £1.2bn."),
    ).toBe(1);
    // A number the check cannot read must appear in a quote as written.
    expect(
      kept("Brora filled two hundred casks.", "Brora closed in 1983."),
    ).toBe(0);
    expect(
      kept(
        "Brora filled two hundred casks.",
        "In 1983 Brora filled two hundred casks.",
      ),
    ).toBe(1);
  });

  test("drops an owner name no quote states", () => {
    const owned = (newOwnerName: string, quote: string) =>
      keepVerifiedCitations(
        draft({
          events: [
            {
              id: 1,
              kind: "acquired",
              date: "2021",
              newOwnerName,
              citations: [{ sourceId: "wp", statedValue: "2021", quote }],
            },
          ],
        }),
        [
          {
            ...page,
            text: `${page.text} Diageo rebuilt Brora. Campbell bought it in 2021.`,
          },
        ],
        null,
      ).events.length;

    // The quote states the year, not who bought it.
    expect(owned("Diageo", "It was rebuilt in 2021 after 38 years.")).toBe(0);
    // A name must be whole words: "Campbell" does not state "Bell".
    expect(owned("Campbell", "Campbell bought it in 2021.")).toBe(1);
    expect(owned("Bell", "Campbell bought it in 2021.")).toBe(0);
  });

  test("needs one quote to state a name", () => {
    const renamed = (name: string, quotes: string[]) =>
      keepVerifiedCitations(
        draft({
          events: [
            {
              id: 1,
              kind: "renamed",
              date: "1983",
              name,
              citations: quotes.map((quote) => ({
                sourceId: "wp",
                statedValue: "1983",
                quote,
              })),
            },
          ],
        }),
        [
          {
            ...page,
            text: `${page.text} Clynelish opened in 1983. Brora Mill closed in 1983.`,
          },
        ],
        null,
      ).events.length;

    // "Clynelish Mill" is built from two quotes; neither states it.
    expect(
      renamed("Clynelish Mill", [
        "Clynelish opened in 1983.",
        "Brora Mill closed in 1983.",
      ]),
    ).toBe(0);
    // A name of only short words must appear whole.
    expect(renamed("No 1", ["Clynelish opened in 1983."])).toBe(0);
    expect(renamed("Clynelish", ["Clynelish opened in 1983."])).toBe(1);
  });

  test("ignores case, quote marks, and punctuation", () => {
    const result = keepVerifiedCitations(
      draft({ events: [event(1, "2021", "rebuilt in 2021, after 38 years")] }),
      [page],
      null,
    );

    expect(result.events).toHaveLength(1);
  });
});

describe("keepVerifiedCitations with the current page", () => {
  test("keeps a quote the current page already has without a read", () => {
    const current = draft({
      events: [event(1, "1983", "Brora closed in 1983.")],
    });

    const result = keepVerifiedCitations(current, [], current);

    expect(result.events).toHaveLength(1);
  });

  test("keeps a publication date the current page already has", () => {
    // The quote has no year; the article's date dates the event.
    const page = (publishedOn: string) =>
      draft({
        sources: [{ ...source, publishedOn }],
        events: [
          {
            id: 1,
            kind: "generic",
            date: "2021",
            text: "Brora reopened.",
            citations: [
              { sourceId: "wp", statedValue: null, quote: "Brora reopened" },
            ],
          },
        ],
      });

    const current = page("2021-05-19");
    expect(keepVerifiedCitations(current, [], current).events).toHaveLength(1);
    expect(
      keepVerifiedCitations(page("2022-05-19"), [], current).events,
    ).toEqual([]);
  });

  test("still checks a changed quote against the pages read", () => {
    const current = draft({
      events: [event(1, "1983", "Brora closed in 1983.")],
    });

    const result = keepVerifiedCitations(
      draft({ events: [event(1, "1985", "Brora closed in 1985.")] }),
      [],
      current,
    );

    expect(result.events).toEqual([]);
  });
});

describe("checkAboutProse", () => {
  const facts = [
    event(1, "1983", "Brora closed in 1983."),
    event(2, "2021", "rebuilt in 2021"),
  ];
  const lead = (sentences: { text: string; factIds: string[] }[]) => [
    { key: "lead", sentences },
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

  test("checks numbers a sentence writes as words", () => {
    expect(
      checkAboutProse(
        draft({
          events: facts,
          sections: lead([
            { text: "It closed in 1983.", factIds: ["event:1"] },
            {
              text: "Two years later, nine men rebuilt it.",
              factIds: ["event:2"],
            },
          ]),
        }),
      ),
    ).toEqual([
      '"Two years later, nine men rebuilt it." (lead) states 2, which its facts do not.',
      '"Two years later, nine men rebuilt it." (lead) states 9, which its facts do not.',
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

  test("allows up to 2 sentences for each shown fact", () => {
    const six = [1, 2, 3, 4, 5, 6].map((id) =>
      event(id, `190${id}`, `It changed in 190${id}.`),
    );
    const prose = (count: number) => [
      ...lead(
        [1, 2, 3, 4].map((id) => ({
          text: `It changed in 190${id}.`,
          factIds: [`event:${id}`],
        })),
      ),
      {
        key: "history",
        heading: "History",
        sentences: Array.from({ length: count - 4 }, (_, i) => ({
          text: `In 190${(i % 6) + 1} it changed.`,
          factIds: [`event:${(i % 6) + 1}`],
        })),
      },
    ];

    expect(
      checkAboutProse(draft({ events: six, sections: prose(12) })),
    ).toEqual([]);
    expect(
      checkAboutProse(draft({ events: six, sections: prose(13) })),
    ).toEqual([
      "The prose has 13 sentences for 6 shown facts; the limit is 12.",
    ]);
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

describe("valuesAgree", () => {
  test("reads a short year range as text, not a month", () => {
    expect(valuesAgree("1969-70", "1969")).toBe(false);
    expect(valuesAgree("1969-07", "1969")).toBe(true);
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

  test("checks an era's range against the stored dates", () => {
    const era = (endDate: string) =>
      draft({
        sources: [
          source,
          { ...source, id: "df", url: "https://www.diffordsguide.com/brora" },
        ],
        events: [
          {
            id: 1,
            kind: "era",
            title: "Heavily peated",
            date: "1969",
            endDate,
            citations: [
              { sourceId: "wp", statedValue: "1969–1973" },
              { sourceId: "df", statedValue: "1969-1974" },
            ],
          },
        ],
      });

    expect(checkConflictPicks(era("1973"))).toEqual([]);
    expect(checkConflictPicks(era("1975"))).toEqual([
      "Event 1 stores 1969–1975, which no source states.",
    ]);
  });

  test("compares only stated dates against an event's date", () => {
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
          date: "1969",
          // These sources state the new name, not a date.
          citations: [
            { sourceId: "wp", statedValue: "Brora" },
            { sourceId: "df", statedValue: "Brora Distillery" },
          ],
        },
      ],
    });

    expect(checkConflictPicks(document)).toEqual([]);
    expect(
      toPublicEntityAbout(
        { entityId: 1, document, version: 1, checkedOn: null },
        new Map(),
      ).events[0]?.disagreement,
    ).toBeNull();
  });

  test("reads the end year of a short year range", () => {
    const reopened = (date: string) =>
      keepVerifiedCitations(
        draft({
          events: [
            {
              id: 1,
              kind: "reopened",
              date,
              citations: [
                {
                  sourceId: "wp",
                  statedValue: date,
                  quote: "Production ceased between 1931-38.",
                },
              ],
            },
          ],
        }),
        [{ ...page, text: `${page.text} Production ceased between 1931-38.` }],
        null,
      ).events.length;

    // "1931-38" states 1938, but not a year it does not span.
    expect(reopened("1938")).toBe(1);
    expect(reopened("1948")).toBe(0);
  });

  test("names the number that dropped a fact", () => {
    const quote = "Brora reopened in 2021.";
    const { dropped } = reviewAboutDraft(
      draft({
        events: [
          {
            id: 1,
            kind: "reopened",
            date: "2021",
            text: "It reopened after a three-year restoration.",
            citations: [{ sourceId: "wp", statedValue: "2021", quote }],
          },
        ],
      }),
      [{ ...page, text: `${page.text} ${quote}` }],
      "distillery",
      null,
    );

    expect(dropped).toEqual([
      "Event 1 (reopened, 2021) was dropped: its text or title states 3, which no kept quote states.",
    ]);
  });

  test("names the quotes that failed when a fact is dropped", () => {
    const withName = "In the same year, it was acquired by Glenmorangie plc.";
    const withYear = "Glenmorangie acquired it in 2004.";
    const { dropped } = reviewAboutDraft(
      draft({
        events: [
          {
            id: 1,
            kind: "acquired",
            date: "2004",
            newOwnerName: "Glenmorangie plc",
            citations: [
              // No year in this quote, so it fails its stated value.
              { sourceId: "wp", statedValue: "2004", quote: withName },
              { sourceId: "wp", statedValue: "2004", quote: withYear },
            ],
          },
        ],
      }),
      [{ ...page, text: `${page.text} ${withName} ${withYear}` }],
      "bottler",
      null,
    );

    expect(dropped).toEqual([
      'Event 1 (acquired, 2004) was dropped: no one kept quote states its new owner "Glenmorangie plc". Its quotes from wp did not pass: a quote must be on a page read and state its statedValue.',
    ]);
  });

  test("reads a stated date range by its years", () => {
    const quote =
      "Between May 1969 and July 1973 Brora made a heavily peated whisky.";
    const kept = keepVerifiedCitations(
      draft({
        events: [
          {
            id: 1,
            kind: "era",
            title: "Heavily peated years",
            date: "1969-05",
            endDate: "1973-07",
            citations: [
              { sourceId: "wp", statedValue: "1969-05\u20131973-07", quote },
            ],
          },
        ],
      }),
      [{ ...page, text: `${page.text} ${quote}` }],
      null,
    );

    expect(kept.events).toHaveLength(1);
  });

  test("keeps an era whose start and end years come from different quotes", () => {
    const start = "Malt Mill was built on the site in 1908.";
    const end = "Malt Mill closed in 1962.";
    const kept = keepVerifiedCitations(
      draft({
        events: [
          {
            id: 1,
            kind: "era",
            title: "Malt Mill",
            date: "1908",
            endDate: "1962",
            citations: [
              { sourceId: "wp", statedValue: "1908", quote: start },
              // The end-year quote has no stated value, so the two do not
              // read as disagreeing.
              { sourceId: "wp", statedValue: null, quote: end },
            ],
          },
        ],
      }),
      [{ ...page, text: `${page.text} ${start} ${end}` }],
      null,
    );

    expect(kept.events).toHaveLength(1);
    expect(getDateDisagreement(kept.events[0]!.citations)).toBeNull();
  });

  test("matches whole numbers only", () => {
    const stills = (value: number, quote: string) =>
      keepVerifiedCitations(
        draft({
          siteFacts: {
            washStills: {
              value,
              asOf: null,
              citations: [
                { sourceId: "wp", statedValue: String(value), quote },
              ],
            },
          },
        }),
        [{ ...page, text: `${page.text} ${quote}` }],
        null,
      ).siteFacts.washStills;

    // 46 is not stated by 46.5; a year after "c." is still a whole number.
    expect(stills(46, "It holds 46.5 thousand litres.")).toBeUndefined();
    expect(stills(1887, "The still dates from c.1887.")).toBeDefined();
    // Small counts written as words state their number, whole words only.
    expect(stills(2, "The two wash stills are heated by steam.")).toBeDefined();
    expect(stills(4, "All four stills were rebuilt.")).toBeDefined();
    expect(stills(10, "The stills tend to run slowly.")).toBeUndefined();
    expect(stills(2, "It has one wash still.")).toBeUndefined();
    // A word inside a larger number is not read.
    expect(stills(2, "It filled twenty-two casks.")).toBeUndefined();
    expect(stills(2, "It filled twenty two casks.")).toBeUndefined();
    expect(stills(2, "It filled twenty\u2013two casks.")).toBeUndefined();
    expect(stills(2, "It filled twenty\u2011two casks.")).toBeUndefined();
    expect(stills(4, "Rebuilt in 1983\u2014four stills in all.")).toBeDefined();
    // A run of number words is a larger number, not a small one.
    expect(stills(2, "It filled two hundred casks.")).toBeUndefined();
    expect(stills(3, "It holds three thousand casks.")).toBeUndefined();
    expect(stills(12, "A twelve-year-old was released.")).toBeDefined();
    // A record that runs table cells together still states a phrase.
    const listing = (value: string, quote: string) =>
      keepVerifiedCitations(
        draft({
          siteFacts: {
            listing: {
              value,
              asOf: null,
              citations: [{ sourceId: "wp", statedValue: value, quote }],
            },
          },
        }),
        [{ ...page, text: `${page.text} ${quote}` }],
        null,
      ).siteFacts.listing;
    expect(
      listing("Category A", "CategoryADate Added08/11/2022"),
    ).toBeDefined();
    expect(
      listing("Category B", "CategoryADate Added08/11/2022"),
    ).toBeUndefined();
    // Millions are read as whole numbers.
    expect(stills(1600000, "It makes 1.6m litres of alcohol.")).toBeDefined();
    expect(stills(2000000, "It makes 2 million litres.")).toBeDefined();
    expect(stills(1600000, "It is 1.6 metres tall.")).toBeUndefined();
    // A value written in millions reads the same way as the quote.
    expect(stills(1600000, "It makes 1.6 million litres.")).toBeDefined();
    // A citation may state the number as the page writes it.
    expect(stills(1.6, "It makes 1.6m litres.")).toBeDefined();
    // An "m" apart from the number is not a million.
    expect(
      stills(1887000000, "Built in 1887 m. by the estate."),
    ).toBeUndefined();
    // "mlpa" (million litres of pure alcohol) states millions, after the
    // number or as a table label before it.
    expect(stills(3400000, "Capacity (mlpa) 3.4")).toBeDefined();
    expect(stills(3400000, "Capacity (mlpa)\ni\n3.4")).toBeDefined();
    expect(stills(4800000, "It makes 4.8 mlpa.")).toBeDefined();
    expect(stills(6500000, "Capacity rose to 6.5mla.")).toBeDefined();
    expect(stills(3400000, "Capacity (mlpa) 3.4 since 2018")).toBeDefined();
    expect(
      stills(2018000000, "Capacity (mlpa) 3.4 since 2018"),
    ).toBeUndefined();
    // Thousands separators are read before millions: "1,250m" is one number.
    expect(stills(1250000000, "It cost £1,250m.")).toBeDefined();
    expect(stills(250000000, "It cost £1,250m.")).toBeUndefined();
  });

  test("reads a stated value written in millions", () => {
    const quote = "It makes 1.6m litres of alcohol a year.";
    const kept = keepVerifiedCitations(
      draft({
        siteFacts: {
          capacityLitres: {
            value: 1600000,
            asOf: null,
            citations: [{ sourceId: "wp", statedValue: "1.6 million", quote }],
          },
        },
      }),
      [{ ...page, text: `${page.text} ${quote}` }],
      null,
    );

    expect(kept.siteFacts.capacityLitres?.citations).toHaveLength(1);
  });

  test("keeps a site fact's date only when a quote states its year", () => {
    const asOf = (date: string) =>
      keepVerifiedCitations(
        draft({
          siteFacts: {
            washStills: {
              value: 1,
              asOf: date,
              citations: [
                {
                  sourceId: "wp",
                  statedValue: "1",
                  quote: "It has 1 wash still.",
                },
              ],
            },
          },
        }),
        [{ ...page, text: `${page.text} It has 1 wash still.` }],
        null,
      ).siteFacts.washStills?.asOf;

    // No quote gives a year, so the date is dropped and the fact stays.
    expect(asOf("2019")).toBeNull();
  });

  test("reads thousands separators and same-year spans", () => {
    expect(
      getDisagreement([
        { sourceId: "wp", statedValue: "500,000", quote: null },
        { sourceId: "df", statedValue: "500000", quote: null },
      ]),
    ).toBeNull();
    // An era that ends in the same year it starts, at coarser precision.
    expect(() =>
      draft({
        events: [
          {
            id: 1,
            kind: "era",
            title: "Trial run",
            date: "1985-06",
            endDate: "1985",
          },
        ],
      }),
    ).not.toThrow();
  });

  test("compares numbers whole, so 2 stills is not 12 or 20", () => {
    const stills = (value: number) =>
      draft({
        sources: [
          source,
          { ...source, id: "df", url: "https://www.diffordsguide.com/brora" },
        ],
        siteFacts: {
          washStills: {
            value,
            asOf: null,
            citations: [
              { sourceId: "wp", statedValue: "12" },
              { sourceId: "df", statedValue: "20" },
            ],
          },
        },
      });

    expect(checkConflictPicks(stills(2))).toEqual([
      "Site fact washStills stores 2, which no source states.",
    ]);
    expect(checkConflictPicks(stills(12))).toEqual([]);
  });
});
