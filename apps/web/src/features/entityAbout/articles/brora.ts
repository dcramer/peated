import type { EntityAbout } from "../entityAbout";

// Evidence and open questions: docs/research/catalog/2026-10-23-brora-about.md
export const broraAbout: EntityAbout = {
  entityId: 116,
  reviewedOn: "2026-10-23",
  lead: {
    text: "Brora is a single-pair distillery in the village of Brora, on the east coast of Sutherland. It opened in 1819 as Clynelish. It took the name Brora around 1969, after a larger Clynelish was built next door. It closed in 1983, sat silent for 38 years, and started distilling again on 19 May 2021.",
    sources: ["hes", "wf7", "df", "dg21"],
  },
  facts: [
    { label: "Founded", value: "1819", sources: ["hes"] },
    {
      label: "First name",
      value: "Clynelish, until about 1969",
      sources: ["df"],
    },
    { label: "Owner", value: "Diageo", entityId: 5558, sources: ["wpDiageo"] },
    { label: "Silent", value: "1983 to 2021", sources: ["dg21"] },
    { label: "Stills", value: "1 pair, the originals", sources: ["dg21"] },
    {
      label: "Capacity",
      value: "800,000 litres of spirit a year",
      sources: ["dg21", "snd"],
    },
    { label: "Water", value: "Clynemilton Burn", sources: ["wf8"] },
    { label: "Listed", value: "Category B, since 1984", sources: ["hes"] },
  ],
  operating: [
    { label: "Producing", start: 1819, end: 1931 },
    { label: "Silent", start: 1931, end: 1938 },
    { label: "Producing", start: 1938, end: 1941 },
    { label: "Silent", start: 1941, end: 1945 },
    { label: "Producing", start: 1945, end: 1983 },
    { label: "Silent", start: 1983, end: 2021 },
    { label: "Producing", start: 2021, end: null },
  ],
  names: [
    { label: "Clynelish", start: 1819, end: 1969 },
    { label: "Brora", start: 1969, end: null },
  ],
  owners: [
    { label: "Sutherland estate", start: 1819, end: 1896 },
    { label: "James Ainslie & Co. and John Risk", start: 1896, end: 1912 },
    { label: "John Risk and DCL", start: 1912, end: 1925 },
    {
      label: "Distillers Company (DCL)",
      start: 1925,
      end: 1986,
      entityId: 366610,
    },
    {
      label: "Guinness (United Distillers)",
      start: 1986,
      end: 1997,
      entityId: 366609,
    },
    { label: "Diageo", start: 1997, end: null, entityId: 5558 },
  ],
  peatedYears: { label: "Heavily peated", start: 1969, end: 1973 },
  sections: [
    {
      id: "name",
      heading: "Two distilleries called Clynelish",
      paragraphs: [
        {
          text: "The building now called Brora was Clynelish for its first 150 years. In 1967 and 1968, its owner built a much larger distillery on the next plot and gave it the Clynelish name. The old site kept working, and customs officers asked for separate names. The old one became Brora.",
          sources: ["wf7", "wf9", "df"],
        },
        {
          text: "So a Clynelish distilled before mid-1968 came from the Brora stills. From 1969 both sites ran side by side, and some early casks from the old site may still say Clynelish. For a 1969 Clynelish, check the bottler's notes.",
          sources: ["wf7", "wf9"],
        },
      ],
      disagreements: [
        {
          topic: "When the name changed",
          text: "Wikipedia says 1968. Difford's Guide and Whiskyfun's archive history point to 1969, when customs asked for separate names. Whiskyfun also notes some casks may not have carried the Brora name until the 1975 restart.",
          sources: ["wp", "df", "wf9"],
        },
      ],
    },
    {
      id: "history",
      heading: "History",
      paragraphs: [],
      subsections: [
        {
          id: "estate",
          heading: "An estate distillery",
          years: "1819–1896",
          paragraphs: [
            {
              text: "The Marquess of Stafford's Sutherland estate built the distillery near Clynelish farm. During the Highland Clearances, the estate had moved farming families from inland glens to the coast at Brora. The distillery gave them a buyer for their barley and a reason to stop distilling illegally. The estate's commissioner, James Loch, put the cost at £750.",
              sources: ["wf2", "hes"],
            },
            {
              text: "The estate leased it to a run of tenants: James Harper first, Andrew Ross from 1834, then George Lawson and his sons from 1846. Early output was about 10,000 gallons a year. When Alfred Barnard visited in 1886, it was nearly 20,000.",
              sources: ["wf2", "wp"],
            },
          ],
        },
        {
          id: "blenders",
          heading: "Blenders take over",
          years: "1896–1967",
          paragraphs: [
            {
              text: "In 1896 the Lawsons sold to the blenders James Ainslie & Co. and their partner John Risk. Ainslie enlarged the site; the range of 7 bonded warehouses from that year still stands.",
              sources: ["wp", "hes"],
            },
            {
              text: "The Distillers Company (DCL) joined John Risk as an owner in 1912 and bought him out in 1925. In 1930 DCL moved the distillery to its malt company, Scottish Malt Distillers.",
              sources: ["wp", "wf6"],
            },
            {
              text: "It closed in March 1931, in the Depression, and restarted in September 1938. It shut again in May 1941, when wartime rules cut the barley sent to distillers, and stayed closed until 1945.",
              sources: ["wf6", "df"],
            },
            {
              text: "The 1960s changed how it worked. In 1961 the stills switched from direct coal fires to steam. The floor maltings were used for the last time in 1965, and the boiler moved from coal to oil in 1966.",
              sources: ["wf7"],
            },
          ],
        },
        {
          id: "peated",
          heading: "The peated years",
          years: "1968–1983",
          paragraphs: [
            {
              text: "The new Clynelish started in June 1968, and the old distillery closed in May. That summer, a drought on Islay cut the supply of the smoky malt that blends such as Johnnie Walker depended on. DCL tested making Islay-style malt on the mainland and picked the old site. Mashing restarted on 28 December 1968.",
              sources: ["wf7"],
            },
            {
              text: "From 1969 Brora made heavily peated malt. By July 1973 DCL had more Islay malt again, and Brora's peating was gradually cut back. The site closed briefly to rebuild the mash house and restarted in April 1975, making less smoky spirit.",
              sources: ["wp", "wf8", "wf9"],
            },
            {
              text: "Brora closed in March 1983, the same year as Port Ellen. The last exciseman wrote in his ledger: “Commencement of Brora Distillery silent season (undetermined period).”",
              sources: ["df", "dg17", "dg21"],
            },
          ],
          disagreements: [
            {
              topic: "How long the peated years lasted",
              text: "Wikipedia gives May 1969 to July 1973 for the heavily peated malt. Whiskyfun's history agrees that peating was cut from 1973, but its author has tasted heavily peated casks from as late as 1981 and 1983.",
              sources: ["wp", "wf8", "wf9"],
            },
            {
              topic: "When it closed",
              text: "Difford's Guide gives March 1983. Wikipedia says only “early 1983.”",
              sources: ["df", "wp"],
            },
          ],
        },
        {
          id: "silent",
          heading: "Silent",
          years: "1983–2021",
          paragraphs: [
            {
              text: "The buildings and stills stayed. In March 1984 Historic Environment Scotland listed the old distillery as a Category B building, including the original kiln with its pagoda roof and the 1896 warehouses. The modern Clynelish next door isn't part of the listing.",
              sources: ["hes"],
            },
            {
              text: "Guinness bought DCL in 1986 and renamed it United Distillers in 1987. Guinness merged with Grand Metropolitan in 1997 to form Diageo, which owns Brora today.",
              sources: ["wpDcl", "wpDiageo"],
            },
          ],
        },
        {
          id: "restored",
          heading: "Restored",
          years: "2017–today",
          paragraphs: [
            {
              text: "In October 2017 Diageo announced £35 million to bring back Brora and Port Ellen. At Brora, the stillhouse was taken down and rebuilt stone by stone, and Diageo's coppersmiths refurbished the original pair of pot stills.",
              sources: ["dg17", "dg21", "snd"],
            },
            {
              text: "On 19 May 2021, master distiller Stewart Bowman filled the first cask of Brora spirit in 38 years. His father was the exciseman who wrote that line in 1983. The distillery can make 800,000 litres of spirit a year and takes visitors by appointment.",
              sources: ["dg21", "snd"],
            },
          ],
        },
      ],
    },
    {
      id: "making",
      heading: "How it's made",
      paragraphs: [
        {
          text: "Brora has 1 wash still and 1 spirit still, the same copper pair that ran until 1983. Its water comes from a weir on the Clynemilton Burn, the same source Clynelish uses.",
          sources: ["dg21", "wf8", "wp"],
        },
        {
          text: "The year a Brora was distilled tells you more about its smoke than the label does. Malt from 1969 to 1973 was heavily peated. Later years were mostly lighter, with exceptions.",
          sources: ["wp", "wf9"],
        },
        {
          text: "Diageo says the restored distillery runs on renewable energy, including a boiler that burns wood chips from northern Scotland.",
          sources: ["dg21", "snd"],
        },
      ],
    },
  ],
  sources: [
    {
      id: "hes",
      title: "Clynelish Brora Distillery (LB578)",
      publisher: "Historic Environment Scotland",
      url: "https://portal.historicenvironment.scot/designation/LB578",
    },
    {
      id: "wf2",
      title: "The Magical History of the Great Brora Distillery, part 2",
      publisher: "Whiskyfun",
      url: "https://www.whiskyfun.com/brorahistoryp2.html",
    },
    {
      id: "wf6",
      title: "The Magical History of the Great Brora Distillery, part 6",
      publisher: "Whiskyfun",
      url: "https://www.whiskyfun.com/brorahistoryp6.html",
    },
    {
      id: "wf7",
      title: "The Magical History of the Great Brora Distillery, part 7",
      publisher: "Whiskyfun",
      url: "https://www.whiskyfun.com/brorahistoryp7.html",
    },
    {
      id: "wf8",
      title: "The Magical History of the Great Brora Distillery, part 8",
      publisher: "Whiskyfun",
      url: "https://www.whiskyfun.com/brorahistoryp8.html",
    },
    {
      id: "wf9",
      title: "The Magical History of the Great Brora Distillery, part 9",
      publisher: "Whiskyfun",
      url: "https://www.whiskyfun.com/brorahistoryp9.html",
    },
    {
      id: "df",
      title: "Brora Distillery (the original Clynelish): history",
      publisher: "Difford's Guide",
      url: "https://www.diffordsguide.com/producers/227/brora-distillery-the-original-clynelish/history",
    },
    {
      id: "wp",
      title: "Brora distillery",
      publisher: "Wikipedia",
      url: "https://en.wikipedia.org/wiki/Brora_distillery",
    },
    {
      id: "wpDcl",
      title: "Distillers Company",
      publisher: "Wikipedia",
      url: "https://en.wikipedia.org/wiki/Distillers_Company",
    },
    {
      id: "wpDiageo",
      title: "Diageo",
      publisher: "Wikipedia",
      url: "https://en.wikipedia.org/wiki/Diageo",
    },
    {
      id: "dg17",
      title: "Iconic ‘lost’ distilleries revived in major Scotch investment",
      publisher: "Diageo, 9 October 2017",
      url: "https://www.diageo.com/en/news-and-media/press-releases/2017/iconic-lost-distilleries-revived-in-major-scotch-investment",
    },
    {
      id: "dg21",
      title:
        "Diageo's iconic ghost distillery of Brora is reawakened after 38 years",
      publisher: "Diageo, 19 May 2021",
      url: "https://www.diageo.com/en/news-and-media/stories/2021/diageo-s-iconic-ghost-distillery-of-brora-is-reawakened-after-38-years",
    },
    {
      id: "snd",
      title: "Diageo reopens Scotland's Brora distillery after 38-year silence",
      publisher: "Shanken News Daily, 19 May 2021",
      url: "https://www.shankennewsdaily.com/2021/05/19/28667/diageo-reopens-scotlands-brora-distillery-after-38-year-silence/",
    },
  ],
};
