# Brora About article — October 23, 2026

This file supports the proof-of-concept About article for Brora (E0116) in
`apps/web/src/features/entityAbout/articles/brora.ts`. No production records
were changed.

## Where the facts live

- Whiskyfun's multi-page [Brora history](https://www.whiskyfun.com/brorahistoryp2.html)
  (parts 2 to 10) is the best archival secondary source. Its author says he
  used Diageo's Menstrie archive and Brian Spiller's 1982 DCL distillery
  histories. It hedges where its sources do, so read the qualifiers. Key pages:
  part 2 (founding, tenants, output), part 6 (1925–1941 ownership and
  closures), part 7 (1960s changes, 1968 split, peated restart), part 8
  (peating cut from July 1973, water), part 9 (1975 restart, the Brora name on
  casks, later peating).
- Historic Environment Scotland [LB578](https://portal.historicenvironment.scot/designation/LB578)
  is the primary source for the buildings: Category B, listed 7 March 1984,
  complex dated 1820 and 1896, enlarged by Ainslie and Co. in 1896. The modern
  Clynelish is excluded. Crown copyright: link, don't copy.
- Diageo's [2017 release](https://www.diageo.com/en/news-and-media/press-releases/2017/iconic-lost-distilleries-revived-in-major-scotch-investment)
  gives £35m and 800,000 litres for Brora and Port Ellen together. Diageo's
  [2021 story](https://www.diageo.com/en/news-and-media/stories/2021/diageo-s-iconic-ghost-distillery-of-brora-is-reawakened-after-38-years)
  gives 19 May 2021, 800,000 litres for Brora alone, the refurbished pair of
  stills, Stewart Bowman, and the exciseman's ledger line.
- Wikipedia's [Brora distillery](https://en.wikipedia.org/wiki/Brora_distillery)
  page has the 1846 Lawson lease, the 1896 sale, DCL in 1912 and 1925, and
  "May 1969 – July 1973" for the heavily peated years. Several lines are
  uncited. The text is CC BY-SA, so don't copy it.
- Difford's Guide [history](https://www.diffordsguide.com/producers/227/brora-distillery-the-original-clynelish/history)
  gives 1931–38 and 1941–45 closures and March 1983.

Whiskyfun's history pages show each year as an image heading, so the page text
never states the year. The About example cites Whiskyfun only for details and
takes every year from a page whose text states it (checked October 24, 2026).
Whiskyfun's 1975 version of the rename sits under such a heading, so the example
shows only 1968 (Wikipedia) and 1969 (Difford's, Whiskyfun's text).

## Conflicts and how the article settles them

| Fact                 | Sources say                                                                                                       | Article                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Rename to Brora      | 1968 (Wikipedia), 1969 (Difford's; Whiskyfun: customs asked in 1969), 1975 (Whiskyfun's alternative; trade press) | "around 1969" with a visible note  |
| Heavily peated years | May 1969–July 1973 (Wikipedia, Whiskyfun); heavily peated 1981 and 1983 casks exist (Whiskyfun tastings)          | 1969–1973, with a visible note     |
| 1983 closure         | March (Difford's), "early 1983" (Wikipedia), 17 March (Whiskyfun, hedged; not re-checked), May (retailers)        | March 1983, with a visible note    |
| DCL control          | joined 1912, full control 1925 (Wikipedia, Whiskyfun); moved to SMD 1930 (Whiskyfun)                              | 1912, 1925, 1930                   |
| 2021 stills          | Most sources: refurbished by Diageo's coppersmiths; one retailer says never removed                               | "refurbished"; location not stated |

## Production record gaps (not fixed)

E0116 needs a separate catalog pass under `docs/operations/catalog-maintenance.md`:

- `status` is null. It should be `active` (reopened 19 May 2021).
- The event "renamed Brora, 1975" states a disputed year as fact.
- All 8 events before 2021 cite one `scotchwhisky.com/whiskypedia/2017/brora/`
  URL that this review could not open.
- Missing events with good sources: 1896 Ainslie rebuild, silent 1931–1938 and
  1941–1945, 1961 steam stills, 1984 listing, 2017 revival announcement.

## Still unknown

- The rename month and year from a primary record.
- The name of the distillery manager after Stewart Bowman left in 2021.
- Release facts for Rare Malts, Special Releases, Prima & Ultima, and the 2021
  Triptych. The article leaves releases out until they are checked.
- Whether 1968 and 1969 "Clynelish" vintages came from the old or new site.
  Bottles stay on the Distillery their label and evidence support.
