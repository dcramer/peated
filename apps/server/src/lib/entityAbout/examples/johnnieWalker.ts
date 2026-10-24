import {
  EntityAboutDocumentSchema,
  type EntityAboutDocument,
} from "@peated/server/schemas/entityAbout";

/**
 * Johnnie Walker's About document, written by a person from the sources in
 * docs/research/catalog/2026-10-24-johnnie-walker-about.md. It is the writer's
 * brand example and a sample of a stored brand document. Quotes are verbatim
 * from the source pages, checked on 2026-10-24.
 */
const JOHNNIE_WALKER_ABOUT_INPUT = {
  sources: [
    {
      id: "dg",
      url: "https://www.diageo.com/en/our-brands/scotch-whisky/johnnie-walker",
      title: "Johnnie Walker Scotch Whisky",
      publisher: "Diageo",
      kind: "official",
    },
    {
      id: "wp",
      url: "https://en.wikipedia.org/wiki/Johnnie_Walker",
      title: "Johnnie Walker",
      publisher: "Wikipedia",
      kind: "reference",
    },
  ],
  events: [
    {
      id: 1,
      kind: "opened",
      date: "1820",
      text: "John Walker opened a grocer's shop in Kilmarnock.",
      citations: [
        {
          sourceId: "dg",
          statedValue: "1820",
          quote:
            "In 1820, the year after his father died and their family farm was sold, John Walker, opened a humble grocer’s shop.",
        },
        {
          sourceId: "wp",
          statedValue: "1820",
          quote:
            "It was established in the Scottish burgh of Kilmarnock in 1820",
        },
      ],
    },
    {
      id: 2,
      kind: "generic",
      date: "1860",
      text: "Alexander Walker introduced the square bottle.",
      citations: [
        {
          sourceId: "wp",
          statedValue: "1860",
          quote:
            "Alexander Walker had introduced the brand's signature square bottle in 1860.",
        },
      ],
    },
    {
      id: 3,
      kind: "generic",
      date: "1865",
      text: "Alexander Walker made the first commercial blend, Old Highland Whisky.",
      citations: [
        {
          sourceId: "wp",
          statedValue: "1865",
          quote:
            "In 1865, Alec created Johnnie Walker's first commercial blend and called it Old Highland Whisky",
        },
      ],
    },
    {
      id: 4,
      kind: "generic",
      date: "1893",
      text: "The Walkers bought Cardhu distillery to secure malt for their blends.",
      citations: [
        {
          sourceId: "wp",
          statedValue: "1893",
          quote:
            "In 1893, Cardhu distillery was purchased by the Walkers to reinforce the stocks of one of the Johnnie Walker blends' key malt whiskies.",
        },
      ],
    },
    {
      id: 5,
      kind: "generic",
      date: "1908",
      text: "The Striding Man first appeared in advertisements.",
      citations: [
        {
          sourceId: "dg",
          statedValue: "1908",
          quote:
            "In 1908, Alexander’s own son commissioned Tom Brown to sketch the Striding Man figure",
        },
        {
          sourceId: "wp",
          statedValue: "1908",
          quote:
            "In 1908, the Walkers created advertisements featuring Browne's Striding Man",
        },
        {
          sourceId: "wp",
          statedValue: "1909",
          quote:
            "In 1909, as part of a rebranding that saw the introduction of the Striding Man",
        },
      ],
    },
    {
      id: 6,
      kind: "generic",
      date: "1909",
      text: "The blends were renamed for their label colours, including Red Label and Black Label.",
      citations: [
        {
          sourceId: "wp",
          statedValue: "1909",
          quote:
            "In 1909, as part of a rebranding that saw the introduction of the Striding Man, a mascot used to the present day that was created by cartoonist Tom Browne,[16] the company re-branded their blends to match the common colour names.",
        },
      ],
    },
    {
      id: 7,
      kind: "generic",
      date: "1920",
      text: "Johnnie Walker was sold in 120 countries.",
      citations: [
        {
          sourceId: "dg",
          statedValue: "1920",
          quote: "By 1920, Johnnie Walker was available in 120 countries.",
        },
      ],
    },
    {
      id: 8,
      kind: "acquired",
      date: "1925",
      newOwnerName: "Distillers Company",
      citations: [
        {
          sourceId: "wp",
          statedValue: "1925",
          quote: "The company joined Distillers Company in 1925.",
        },
      ],
    },
    {
      id: 9,
      kind: "acquired",
      date: "1986",
      newOwnerName: "Guinness",
      citations: [
        {
          sourceId: "wp",
          statedValue: "1986",
          quote: "Distillers Company was acquired by Guinness in 1986",
        },
      ],
    },
    {
      id: 10,
      kind: "acquired",
      date: "1997",
      newOwnerName: "Diageo",
      citations: [
        {
          sourceId: "wp",
          statedValue: "1997",
          quote:
            "Guinness merged with Grand Metropolitan to form Diageo in 1997",
        },
      ],
    },
    {
      id: 11,
      kind: "generic",
      date: "2012-03",
      text: "The Kilmarnock plant closed.",
      citations: [
        {
          sourceId: "wp",
          statedValue: "2012-03",
          quote:
            "The Johnnie Walker plant in Kilmarnock closed its doors in March 2012",
        },
      ],
    },
    {
      id: 12,
      kind: "generic",
      date: "2021-09",
      text: "Johnnie Walker Princes Street, a visitor site in Edinburgh, opened.",
      citations: [
        {
          sourceId: "wp",
          statedValue: "2021-09",
          quote: "Johnnie Walker Princes Street opened in September 2021.",
        },
        {
          sourceId: "dg",
          statedValue: "2021",
          quote: "Johnnie Walker Princes Street opened in 2021.",
        },
      ],
    },
  ],
  sections: [
    {
      key: "lead",
      sentences: [
        {
          text: "Johnnie Walker is a Scotch whisky brand that grew out of John Walker's grocer's shop in Kilmarnock, opened in 1820.",
          factIds: ["event:1"],
        },
        {
          text: "Diageo has owned it since 1997.",
          factIds: ["event:10"],
        },
      ],
    },
    {
      key: "family",
      heading: "The Walker family",
      sentences: [
        {
          text: "Alexander Walker introduced the square bottle in 1860.",
          factIds: ["event:2"],
        },
        {
          text: "In 1865 he made the first commercial blend, Old Highland Whisky.",
          factIds: ["event:3"],
        },
        {
          text: "The Walkers bought Cardhu distillery in 1893 to secure malt for their blends.",
          factIds: ["event:4"],
        },
        {
          text: "The Striding Man first appeared in advertisements in 1908.",
          factIds: ["event:5"],
        },
        {
          text: "In 1909 the blends were renamed for their label colours, including Red Label and Black Label.",
          factIds: ["event:6"],
        },
        {
          text: "By 1920 it was sold in 120 countries.",
          factIds: ["event:7"],
        },
      ],
    },
    {
      key: "owners",
      heading: "From family firm to Diageo",
      sentences: [
        {
          text: "The firm joined the Distillers Company in 1925.",
          factIds: ["event:8"],
        },
        {
          text: "Guinness bought the Distillers Company in 1986, and Diageo was formed in 1997.",
          factIds: ["event:9", "event:10"],
        },
      ],
    },
    {
      key: "kilmarnock",
      heading: "Leaving Kilmarnock",
      sentences: [
        {
          text: "The Kilmarnock plant closed in March 2012.",
          factIds: ["event:11"],
        },
        {
          text: "Johnnie Walker Princes Street, a visitor site in Edinburgh, opened in September 2021.",
          factIds: ["event:12"],
        },
      ],
    },
  ],
};

function writtenByPerson<T extends object>(items: T[]) {
  return items.map((item) => ({ ...item, writtenBy: "person" }));
}

export const JOHNNIE_WALKER_ABOUT_EXAMPLE: EntityAboutDocument =
  EntityAboutDocumentSchema.parse({
    sources: JOHNNIE_WALKER_ABOUT_INPUT.sources,
    events: writtenByPerson(JOHNNIE_WALKER_ABOUT_INPUT.events),
    siteFacts: {},
    sections: writtenByPerson(JOHNNIE_WALKER_ABOUT_INPUT.sections),
  });
