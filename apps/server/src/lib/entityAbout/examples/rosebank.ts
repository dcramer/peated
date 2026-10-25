import {
  EntityAboutDocumentSchema,
  type EntityAboutDocument,
} from "@peated/server/schemas/entityAbout";

/**
 * Rosebank's About document, written by a person from the sources in
 * docs/research/catalog/2026-10-25-rosebank-about.md. It is the writer's
 * distillery example and a sample of a stored document. Quotes are verbatim
 * from the source pages, checked on 2026-10-25.
 */
const ROSEBANK_ABOUT_INPUT = {
  sources: [
    {
      id: "rbStory",
      url: "https://www.rosebank.com/our-story",
      title: "Our Story",
      publisher: "Rosebank Distillery",
      kind: "official",
    },
    {
      id: "rbBeginnings",
      url: "https://www.rosebank.com/our-beginnings",
      title: "Rosebank Beginnings",
      publisher: "Rosebank Distillery",
      kind: "official",
    },
    {
      id: "rbFirst",
      url: "https://www.rosebank.com/our-journal/rosebank-first-iconic-moments",
      title: "Witness Rosebank's First Iconic Moments",
      publisher: "Rosebank Distillery",
      kind: "official",
    },
    {
      id: "hes",
      url: "https://portal.historicenvironment.scot/designation/LB44184",
      title:
        "Former Rosebank Distillery, Forth and Clyde Canal, Camelon Road, Falkirk (LB44184)",
      publisher: "Historic Environment Scotland",
      kind: "official",
    },
    {
      id: "wp",
      url: "https://en.wikipedia.org/wiki/Rosebank_distillery",
      title: "Rosebank distillery",
      publisher: "Wikipedia",
      kind: "reference",
    },
    {
      id: "swp",
      url: "https://scotchwhisky.com/whiskypedia/2076/rosebank/",
      title: "Rosebank",
      publisher: "ScotchWhisky.com (Whiskypedia)",
      kind: "reference",
    },
    {
      id: "wa17",
      url: "https://whiskyadvocate.com/rosebank-distillery-will-reopen",
      title: "Rosebank Distillery Will Reopen",
      publisher: "Whisky Advocate",
      publishedOn: "2017-10-10",
      kind: "press",
    },
    {
      id: "wa23",
      url: "https://whiskyadvocate.com/Rosebank-Restarts-Production-After-Three-Decades-of-Silence",
      title: "Rosebank Restarts Production After Three Decades of Silence",
      publisher: "Whisky Advocate",
      publishedOn: "2023-07-25",
      kind: "press",
    },
  ],
  events: [
    {
      id: 1,
      kind: "opened",
      date: "1840",
      text: "James Rankine turned the maltings of the old Camelon distillery, beside the Forth & Clyde canal just west of Falkirk, into Rosebank.",
      citations: [
        {
          sourceId: "rbStory",
          statedValue: "1840",
          quote:
            "Rosebank fired into life in 1840 on the banks of the Forth & Clyde canal, just west of Falkirk in the heart of the Lowlands.",
        },
        {
          sourceId: "hes",
          statedValue: "1840",
          quote:
            "James Rankine converted the maltings of the Camelon distillery to the main distillery and renamed it Rosebank in circa 1840",
        },
        {
          sourceId: "wp",
          statedValue: "1840",
          quote:
            "The distillery was founded on its present site in 1840 by James Rankine, a local wine merchant",
        },
      ],
    },
    {
      id: 2,
      kind: "generic",
      date: "1864",
      text: "James Rankine's son, R W Rankine, rebuilt and enlarged the distillery.",
      citations: [
        {
          sourceId: "hes",
          statedValue: "1864",
          quote:
            "from 1864-6 his son, R W Rankine, rebuilt and expanded the distillery",
        },
        {
          sourceId: "wp",
          statedValue: "1864",
          quote:
            "The new Rosebank quickly grew, requiring expansion in 1845 and rebuilding in 1864.",
        },
        {
          sourceId: "rbBeginnings",
          statedValue: "1868",
          quote:
            "His son, Robert went on to acquire Camelon which he demolished, and then rebuilt the Rosebank distillery in 1868, at which point it straddled the canal.",
        },
      ],
    },
    {
      id: 3,
      kind: "generic",
      date: "1894",
      text: "The business became a limited company, Rosebank Distillery Ltd.",
      citations: [
        {
          sourceId: "hes",
          statedValue: "1894",
          quote:
            "In 1894 the distillery became a limited company as Rosebank Distillery Ltd",
        },
        {
          sourceId: "wp",
          statedValue: "1894",
          quote: "Rosebank Distillery Ltd was formed in 1894",
        },
      ],
    },
    {
      id: 4,
      kind: "acquired",
      date: "1914",
      newOwnerName: "Scottish Malt Distillers",
      text: "Rosebank was a founding member of this group of Lowland distilleries.",
      citations: [
        {
          sourceId: "swp",
          statedValue: "1914",
          quote:
            "1914 The distillery becomes a founding member of Scottish Malt Distillers",
        },
        {
          sourceId: "hes",
          statedValue: "1914",
          quote:
            "which subsequently merged with Scottish Malt Distillers in 1914",
        },
      ],
    },
    {
      id: 5,
      kind: "acquired",
      date: "1925",
      newOwnerName: "The Distillers Company",
      citations: [
        {
          sourceId: "wp",
          statedValue: "1925",
          quote:
            "In 1925, Scottish Malt Distillers. became part of The Distillers Company (DCL).",
        },
        {
          sourceId: "swp",
          statedValue: "1925",
          quote: "1925 Rosebank forms part of DCL",
        },
      ],
    },
    {
      id: 6,
      kind: "acquired",
      date: "1986",
      newOwnerName: "United Distillers",
      citations: [
        {
          sourceId: "swp",
          statedValue: "1986",
          quote: "United Distillers 1986 - 1997",
        },
      ],
    },
    {
      id: 7,
      kind: "acquired",
      date: "1997",
      newOwnerName: "Diageo",
      citations: [
        {
          sourceId: "swp",
          statedValue: "1997",
          quote: "Diageo 1997 - 2017",
        },
      ],
    },
    {
      id: 8,
      kind: "closed",
      date: "1993-06-30",
      citations: [
        {
          sourceId: "wa23",
          statedValue: "1993-06-30",
          quote:
            "The distillery, located in the town of Falkirk, closed on June 30th, 1993.",
        },
        {
          sourceId: "rbStory",
          statedValue: "1993",
          quote:
            "with too much blended whisky in the market, Rosebank closed in 1993",
        },
        {
          sourceId: "swp",
          statedValue: "1993",
          quote:
            "1993 The distillery is closed due to the cost of refurbishment",
        },
      ],
    },
    {
      id: 9,
      kind: "generic",
      date: "1997-04-25",
      text: "The old distillery was listed as a Category B building.",
      citations: [
        {
          sourceId: "hes",
          statedValue: "1997-04-25",
          quote: "Category B Date Added 25/04/1997",
        },
      ],
    },
    {
      id: 10,
      kind: "generic",
      date: "2002",
      text: "The owner sold the site to British Waterways but kept the Rosebank name.",
      citations: [
        {
          sourceId: "wa17",
          statedValue: "2002",
          quote:
            "sold the site to British Waterways (also known as Scottish Canals) in 2002 while retaining the trademark for the Rosebank name",
        },
        {
          sourceId: "swp",
          statedValue: "2002",
          quote: "The distillery site was sold in 2002 to British Waterways.",
        },
      ],
    },
    {
      id: 11,
      kind: "generic",
      date: "2008",
      text: "Thieves took its 3 copper stills, which dated from 1962.",
      citations: [
        {
          sourceId: "rbStory",
          statedValue: "2008",
          quote:
            "when copper thieves broke in and destroyed the stills in 2008",
        },
        {
          sourceId: "hes",
          statedValue: "2008",
          quote: "3 copper stills from 1962 lost to theft circa 2008",
        },
      ],
    },
    {
      id: 12,
      kind: "acquired",
      date: "2017-10",
      newOwnerName: "Ian Macleod Distillers",
      text: "The firm bought the site from Scottish Canals and the Rosebank name from Diageo.",
      citations: [
        {
          sourceId: "wp",
          statedValue: "2017-10",
          quote:
            "In October 2017, Ian Macleod Distillers announced that they had acquired the Rosebank Whisky trademark from Diageo and the site from Scottish Canals",
        },
        {
          sourceId: "rbStory",
          statedValue: "2017",
          quote:
            "Rosebank was rescued just in time by Ian Macleod Distillers in 2017.",
        },
      ],
    },
    {
      id: 13,
      kind: "era",
      date: "1993",
      endDate: "2023",
      title: "Silent",
      citations: [
        {
          sourceId: "wp",
          statedValue: "1993",
          quote:
            "Rosebank Distillery closed its doors in 1993 and the lay empty for three decades.",
        },
        {
          sourceId: "rbFirst",
          quote:
            "on the 5th June 2023 Rosebank began producing new make spirit",
        },
      ],
    },
    {
      id: 14,
      kind: "reopened",
      date: "2023-06-05",
      text: "New stills were built from archive blueprints to keep the form of the originals.",
      citations: [
        {
          sourceId: "rbFirst",
          statedValue: "2023-06-05",
          quote:
            "After almost 30 years to the day since its untimely closure, on the 5th June 2023 Rosebank began producing new make spirit.",
        },
        {
          sourceId: "rbFirst",
          quote:
            "Using archive blueprints, our new stills retain the form and characteristics of the originals.",
        },
        {
          sourceId: "wp",
          statedValue: "2023-07",
          quote: "In July 2023 production restarted at Rosebank distillery.",
        },
      ],
    },
  ],
  siteFacts: {
    listing: {
      value: "Category B",
      asOf: "1997",
      citations: [
        {
          sourceId: "hes",
          statedValue: "Category B",
          quote: "Category B Date Added 25/04/1997",
        },
      ],
    },
  },
  sections: [
    {
      key: "lead",
      sentences: [
        {
          text: "Rosebank opened in 1840 beside the Forth & Clyde canal, just west of Falkirk.",
          factIds: ["event:1"],
        },
        {
          text: "James Rankine set it up in the maltings of the old Camelon distillery.",
          factIds: ["event:1"],
        },
        {
          text: "It closed in 1993 and began making spirit again on 5 June 2023.",
          factIds: ["event:8", "event:14"],
        },
      ],
    },
    {
      key: "canal",
      heading: "Built beside the canal",
      sentences: [
        {
          text: "In 1864 James Rankine's son, R W Rankine, rebuilt and enlarged the distillery.",
          factIds: ["event:2"],
        },
        {
          text: "In April 1997 the old buildings were listed as Category B.",
          factIds: ["event:9"],
        },
      ],
    },
    {
      key: "owners",
      heading: "Owners",
      sentences: [
        {
          text: "The business became a limited company, Rosebank Distillery Ltd, in 1894.",
          factIds: ["event:3"],
        },
        {
          text: "In 1914 it was a founding member of Scottish Malt Distillers, which became part of the Distillers Company in 1925.",
          factIds: ["event:4", "event:5"],
        },
        {
          text: "United Distillers became the owner in 1986, and Diageo in 1997.",
          factIds: ["event:6", "event:7"],
        },
        {
          text: "In 2002 the site was sold to British Waterways, but the Rosebank name was kept.",
          factIds: ["event:10"],
        },
        {
          text: "Ian Macleod Distillers bought the site and the Rosebank name in October 2017.",
          factIds: ["event:12"],
        },
      ],
    },
    {
      key: "silent",
      heading: "Silent",
      eraEventId: 13,
      sentences: [
        {
          text: "It closed on 30 June 1993 and lay empty for three decades.",
          factIds: ["event:8", "event:13"],
        },
        {
          text: "In 2008 thieves took its 3 copper stills, which dated from 1962.",
          factIds: ["event:11"],
        },
        {
          text: "New stills were built from archive blueprints, and on 5 June 2023 it made spirit again.",
          factIds: ["event:14"],
        },
      ],
    },
  ],
};

export const ROSEBANK_ABOUT_EXAMPLE: EntityAboutDocument =
  EntityAboutDocumentSchema.parse({
    sources: ROSEBANK_ABOUT_INPUT.sources,
    events: ROSEBANK_ABOUT_INPUT.events,
    siteFacts: ROSEBANK_ABOUT_INPUT.siteFacts,
    sections: ROSEBANK_ABOUT_INPUT.sections,
  });
