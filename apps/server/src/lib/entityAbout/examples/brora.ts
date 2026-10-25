import {
  EntityAboutDocumentSchema,
  type EntityAboutDocument,
} from "@peated/server/schemas/entityAbout";

/**
 * Brora's About document, written by a person from the sources in
 * docs/research/catalog/2026-10-23-brora-about.md. It is the mock API's About
 * page and a sample of a stored document. It is not a writer example: Brora
 * is a model-check case. Quotes are verbatim from the source pages, checked
 * on 2026-10-23.
 */
const BRORA_ABOUT_INPUT = {
  sources: [
    {
      id: "hes",
      url: "https://portal.historicenvironment.scot/designation/LB578",
      title: "Clynelish Brora Distillery (LB578)",
      publisher: "Historic Environment Scotland",
      kind: "official",
    },
    {
      id: "wf2",
      url: "https://www.whiskyfun.com/brorahistoryp2.html",
      title: "The Magical History of the Great Brora Distillery, part 2",
      publisher: "Whiskyfun",
      kind: "reference",
    },
    {
      id: "wf6",
      url: "https://www.whiskyfun.com/brorahistoryp6.html",
      title: "The Magical History of the Great Brora Distillery, part 6",
      publisher: "Whiskyfun",
      kind: "reference",
    },
    {
      id: "wf7",
      url: "https://www.whiskyfun.com/brorahistoryp7.html",
      title: "The Magical History of the Great Brora Distillery, part 7",
      publisher: "Whiskyfun",
      kind: "reference",
    },
    {
      id: "wf8",
      url: "https://www.whiskyfun.com/brorahistoryp8.html",
      title: "The Magical History of the Great Brora Distillery, part 8",
      publisher: "Whiskyfun",
      kind: "reference",
    },
    {
      id: "wf9",
      url: "https://www.whiskyfun.com/brorahistoryp9.html",
      title: "The Magical History of the Great Brora Distillery, part 9",
      publisher: "Whiskyfun",
      kind: "reference",
    },
    {
      id: "df",
      url: "https://www.diffordsguide.com/producers/227/brora-distillery-the-original-clynelish/history",
      title: "Brora Distillery (the original Clynelish): history",
      publisher: "Difford's Guide",
      kind: "press",
    },
    {
      id: "wp",
      url: "https://en.wikipedia.org/wiki/Brora_distillery",
      title: "Brora distillery",
      publisher: "Wikipedia",
      kind: "reference",
    },
    {
      id: "wpDcl",
      url: "https://en.wikipedia.org/wiki/Distillers_Company",
      title: "Distillers Company",
      publisher: "Wikipedia",
      kind: "reference",
    },
    {
      id: "wpDiageo",
      url: "https://en.wikipedia.org/wiki/Diageo",
      title: "Diageo",
      publisher: "Wikipedia",
      kind: "reference",
    },
    {
      id: "dg17",
      url: "https://www.diageo.com/en/news-and-media/press-releases/2017/iconic-lost-distilleries-revived-in-major-scotch-investment",
      title: "Iconic 'lost' distilleries revived in major Scotch investment",
      publisher: "Diageo",
      publishedOn: "2017-10-09",
      kind: "official",
    },
    {
      id: "dg21",
      url: "https://www.diageo.com/en/news-and-media/stories/2021/diageo-s-iconic-ghost-distillery-of-brora-is-reawakened-after-38-years",
      title:
        "Diageo's iconic ghost distillery of Brora is reawakened after 38 years",
      publisher: "Diageo",
      publishedOn: "2021-05-19",
      kind: "official",
    },
    {
      id: "snd",
      url: "https://www.shankennewsdaily.com/2021/05/19/28667/diageo-reopens-scotlands-brora-distillery-after-38-year-silence/",
      title: "Diageo reopens Scotland's Brora distillery after 38-year silence",
      publisher: "Shanken News Daily",
      publishedOn: "2021-05-19",
      kind: "press",
    },
  ],
  events: [
    {
      id: 1,
      kind: "opened",
      date: "1819",
      name: "Clynelish",
      text: "The Sutherland estate built it near Clynelish farm to give tenant farmers a buyer for their barley.",
      citations: [
        {
          sourceId: "hes",
          statedValue: "1819",
          quote: "Founded in 1819 by Sutherland Estate",
        },
        {
          sourceId: "df",
          statedValue: "1819",
          quote: "Originally founded in 1819 as Clynelish Distillery",
        },
        {
          sourceId: "wf2",
          quote:
            "Upon this farm also there has just been erected a distillery at an expense of £750.",
        },
      ],
    },
    {
      id: 2,
      kind: "acquired",
      date: "1896",
      newOwnerName: "James Ainslie & Co. and John Risk",
      text: "The blenders bought the distillery and enlarged it.",
      citations: [
        {
          sourceId: "hes",
          statedValue: "1896",
          quote: "Enlarged in 1896 by Ainslie and Co.",
        },
        {
          sourceId: "wp",
          statedValue: "1896",
          quote:
            "In 1896 they sold it to the Glasgow blender James Ainslie and his business partner John Risk.",
        },
      ],
    },
    {
      id: 3,
      kind: "acquired",
      date: "1912",
      newOwnerName: "John Risk and the Distillers Company",
      citations: [
        {
          sourceId: "wp",
          statedValue: "1912",
          quote:
            "In 1912 The Distillers Company join John Risk and take full control of the distillery in 1925.",
        },
      ],
    },
    {
      id: 4,
      kind: "acquired",
      date: "1925",
      newOwnerName: "The Distillers Company",
      citations: [
        {
          sourceId: "wp",
          statedValue: "1925",
          quote:
            "In 1912 The Distillers Company join John Risk and take full control of the distillery in 1925.",
        },
        {
          sourceId: "wf6",
          quote: "John Risk disposes of his holding to D.C.L.",
        },
      ],
    },
    {
      id: 5,
      kind: "closed",
      date: "1931-03",
      citations: [
        {
          sourceId: "wf6",
          quote: "Clynelish is closed in March.",
        },
        {
          sourceId: "df",
          statedValue: "1931",
          quote:
            "Production ceased between 1931-38 and again during the Second World War 1941-1945.",
        },
      ],
    },
    {
      id: 6,
      kind: "reopened",
      date: "1938-09",
      citations: [
        {
          sourceId: "wf6",
          quote: "Clynelish is restarted in September.",
        },
        {
          sourceId: "df",
          statedValue: "1938",
          quote:
            "Production ceased between 1931-38 and again during the Second World War 1941-1945.",
        },
      ],
    },
    {
      id: 7,
      kind: "closed",
      date: "1941-05",
      text: "Wartime rules cut the barley sent to distillers.",
      citations: [
        {
          sourceId: "wf6",
          quote:
            "Clynelish shuts down in May, on account of wartime restrictions on the supply of barley to distillers.",
        },
        {
          sourceId: "df",
          statedValue: "1941",
          quote:
            "Production ceased between 1931-38 and again during the Second World War 1941-1945.",
        },
      ],
    },
    {
      id: 8,
      kind: "reopened",
      date: "1945",
      citations: [
        {
          sourceId: "df",
          statedValue: "1945",
          quote:
            "Production ceased between 1931-38 and again during the Second World War 1941-1945.",
        },
      ],
    },
    {
      id: 9,
      kind: "generic",
      date: "1961",
      text: "The stills switched from direct coal fires to steam.",
      citations: [
        {
          sourceId: "wf7",
          quote:
            "The two stills are converted from direct coal heating to internal steam heating.",
        },
        {
          sourceId: "df",
          statedValue: "1961",
          quote: "converted to steam in 1961",
        },
      ],
    },
    {
      id: 10,
      kind: "generic",
      date: "1967",
      text: "A larger distillery was built next door and given the Clynelish name.",
      citations: [
        {
          sourceId: "wf7",
          quote:
            "a second, modern distillery is being built on an adjacent site",
        },
        {
          sourceId: "df",
          statedValue: "1967",
          quote:
            "Then in 1967-68 a brand new, much larger distillery with three pairs of stills as opposed to one was built alongside the old Victorian distillery.",
        },
      ],
    },
    {
      id: 11,
      kind: "closed",
      date: "1968-05",
      citations: [
        {
          sourceId: "wf7",
          statedValue: "1968-05",
          quote: "The old distillery is closed in may 1968.",
        },
      ],
    },
    {
      id: 12,
      kind: "reopened",
      date: "1968-12-28",
      text: "A drought on Islay left blenders short of smoky malt, so the old site restarted to make it.",
      citations: [
        {
          sourceId: "wf7",
          statedValue: "1968",
          quote: "the summer of 1968 is very dry on Islay",
        },
        {
          sourceId: "wf7",
          quote: "Mashing starts on December 28",
        },
      ],
    },
    {
      id: 13,
      kind: "renamed",
      date: "1969",
      name: "Brora",
      citations: [
        {
          sourceId: "df",
          statedValue: "1969",
          quote:
            "in 1969 the original Clynelish distillery had the humiliation of being renamed Brora.",
        },
        {
          sourceId: "wp",
          statedValue: "1968",
          quote:
            'until the opening of the Clynelish Distillery in 1968, whereupon the name of the original Clynelish was changed to "Brora".',
        },
        {
          sourceId: "wf9",
          statedValue: "1969",
          quote:
            "the Customs & Excise asked for separate names already in 1969",
        },
      ],
    },
    {
      id: 14,
      kind: "era",
      date: "1969",
      endDate: "1973",
      title: "Heavily peated",
      citations: [
        {
          sourceId: "wp",
          statedValue: "1969–1973",
          quote: "Between May 1969 and July 1973",
        },
        {
          sourceId: "wf8",
          quote: "The peat content of Brora malt is gradually reduced.",
        },
      ],
    },
    {
      id: 15,
      kind: "closed",
      date: "1983-03",
      citations: [
        {
          sourceId: "df",
          statedValue: "1983-03",
          quote: "It was finally shut down altogether in March 1983.",
        },
        {
          sourceId: "wp",
          statedValue: "1983",
          quote:
            "It operated between 1819 and 1983 before being mothballed until 2021, when it was reactivated.",
        },
        {
          sourceId: "dg17",
          statedValue: "1983",
          quote: "have been silent since they were closed in 1983",
        },
      ],
    },
    {
      id: 16,
      kind: "acquired",
      date: "1986",
      newOwnerName: "Guinness",
      citations: [
        {
          sourceId: "wpDcl",
          statedValue: "1986",
          quote: "was finally acquired by Guinness in 1986",
        },
      ],
    },
    {
      id: 17,
      kind: "acquired",
      date: "1997",
      newOwnerName: "Diageo",
      citations: [
        {
          sourceId: "wpDiageo",
          statedValue: "1997",
          quote: "Diageo was formed in 1997 from the merger of Guinness plc",
        },
      ],
    },
    {
      id: 18,
      kind: "generic",
      date: "1984-03-07",
      text: "The old distillery was listed as a Category B building.",
      citations: [
        {
          sourceId: "hes",
          statedValue: "1984-03-07",
          quote: "Category B Date Added 07/03/1984",
        },
      ],
    },
    {
      id: 19,
      kind: "generic",
      date: "2017-10-09",
      text: "Diageo announced £35 million to bring back Brora and Port Ellen.",
      citations: [
        {
          sourceId: "dg17",
          quote: "£35 million investment by Diageo",
        },
        {
          sourceId: "wp",
          statedValue: "2017-10-09",
          quote:
            "On 9 October 2017 Diageo announced that it will re-open the Brora distillery with production resuming in 2020.",
        },
      ],
    },
    {
      id: 20,
      kind: "reopened",
      date: "2021-05-19",
      text: "The stillhouse was rebuilt stone by stone and the original pair of stills refurbished.",
      citations: [
        {
          sourceId: "dg21",
          quote: "first cask of Brora spirit in more than 38 years",
        },
        {
          sourceId: "snd",
          statedValue: "2021-05-19",
          quote:
            "May 19, 2021 Diageo has officially reopened its Brora Distillery",
        },
      ],
    },
  ],
  siteFacts: {
    waterSource: {
      value: "Clynemilton Burn",
      citations: [
        {
          sourceId: "wf8",
          statedValue: "Clynemilton Burn",
          quote: "piped from a weir on the Clynemilton Burn",
        },
      ],
    },
    listing: {
      value: "Category B",
      asOf: "1984",
      citations: [
        {
          sourceId: "hes",
          statedValue: "Category B",
          quote: "Category B Date Added 07/03/1984",
        },
      ],
    },
  },
  sections: [
    {
      key: "lead",
      sentences: [
        {
          text: "Brora opened in 1819 as Clynelish and took the name Brora around 1969.",
          factIds: ["event:1", "event:13"],
        },
        {
          text: "It closed in March 1983 and started distilling again on 19 May 2021.",
          factIds: ["event:15", "event:20"],
        },
      ],
    },
    {
      key: "name",
      heading: "Two distilleries called Clynelish",
      sentences: [
        {
          text: "In 1967 work began on a larger distillery next door, and it took the Clynelish name.",
          factIds: ["event:10"],
        },
        {
          text: "The old site closed in May 1968, restarted that December, and became Brora.",
          factIds: ["event:11", "event:12", "event:13"],
        },
        {
          text: "So a Clynelish distilled before mid-1968 came from the stills now called Brora.",
          factIds: ["event:11"],
        },
      ],
    },
    {
      key: "estate",
      heading: "An estate distillery",
      sentences: [
        {
          text: "The Sutherland estate built it near Clynelish farm for £750.",
          factIds: ["event:1"],
        },
        {
          text: "It gave tenant farmers a buyer for their barley.",
          factIds: ["event:1"],
        },
      ],
    },
    {
      key: "blenders",
      heading: "Blenders take over",
      sentences: [
        {
          text: "In 1896 the blenders James Ainslie & Co. and John Risk bought it and enlarged it.",
          factIds: ["event:2"],
        },
        {
          text: "The Distillers Company joined John Risk in 1912 and took full control in 1925.",
          factIds: ["event:3", "event:4"],
        },
        {
          text: "It closed in March 1931, restarted in September 1938, and was shut again from 1941 to 1945.",
          factIds: ["event:5", "event:6", "event:7", "event:8"],
        },
        {
          text: "In 1961 its stills switched from direct coal fires to steam.",
          factIds: ["event:9"],
        },
      ],
    },
    {
      key: "peated",
      heading: "The peated years",
      eraEventId: 14,
      sentences: [
        {
          text: "A drought on Islay in 1968 left blenders short of smoky malt, so the old site restarted to make it.",
          factIds: ["event:12"],
        },
        {
          text: "Brora made heavily peated malt from 1969 to 1973.",
          factIds: ["event:14"],
        },
        {
          text: "It closed in March 1983, the same year as Port Ellen.",
          factIds: ["event:15"],
        },
      ],
    },
    {
      key: "silent",
      heading: "Silent",
      sentences: [
        {
          text: "In March 1984 the old buildings were listed as Category B.",
          factIds: ["event:18"],
        },
        {
          text: "Guinness bought the Distillers Company in 1986, and Diageo was formed in 1997.",
          factIds: ["event:16", "event:17"],
        },
      ],
    },
    {
      key: "restored",
      heading: "Restored",
      sentences: [
        {
          text: "In October 2017 Diageo announced £35 million to bring back Brora and Port Ellen.",
          factIds: ["event:19"],
        },
        {
          text: "The stillhouse was rebuilt stone by stone, and the original pair of stills was refurbished.",
          factIds: ["event:20"],
        },
        {
          text: "On 19 May 2021 it filled its first cask in 38 years.",
          factIds: ["event:20"],
        },
      ],
    },
    {
      key: "making",
      heading: "How it's made",
      sentences: [
        {
          text: "Its water comes from a weir on the Clynemilton Burn.",
          factIds: ["site:waterSource"],
        },
      ],
    },
  ],
};

export const BRORA_ABOUT_EXAMPLE: EntityAboutDocument =
  EntityAboutDocumentSchema.parse({
    sources: BRORA_ABOUT_INPUT.sources,
    events: BRORA_ABOUT_INPUT.events,
    siteFacts: BRORA_ABOUT_INPUT.siteFacts,
    sections: BRORA_ABOUT_INPUT.sections,
  });
