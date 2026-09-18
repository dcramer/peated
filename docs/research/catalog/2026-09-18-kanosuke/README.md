# Kanosuke — September 18, 2026

This production review covered every whisky release from Kanosuke Distillery
(嘉之助蒸溜所, Hioki, Kagoshima; owner Komasa Jyozo) from its first single malt
in June 2021 to September 2026, plus the sister-site Hioki Pot Still whisky
sold under the Kanosuke Brand and the independent bottlings that name the
distillery. Writes were made to production through the authenticated API
during the afternoon of September 18, 2026, Pacific time, in two passes: a
local dry run that built the work list, then the write pass after the Brand,
Series, and bottler rules in the identity model were settled. Re-fetch records
before reusing any ID here.

`kanosuke.csv` is the work list: one row per release with its final status,
production ID, every stored field, the evidence page, and the note that
explains each conflict or gap.

## Result

| Status       | Rows | Meaning                                                             |
| ------------ | ---- | ------------------------------------------------------------------- |
| created      | 90   | New Bottles `B57458` to `B57547`, all marked reviewed               |
| updated      | 10   | Existing Bottles corrected                                          |
| unresolved   | 19   | Release known but identity or facts not proven                      |
| no change    | 2    | Package variants recorded as references on the core Bottle          |
| out of scope | 21   | New-make, shochu, RTD, packaging, private casks, non-sale set items |
| **total**    | 142  |                                                                     |

Peated held 12 Kanosuke Bottles and 2 Series before the work. Afterwards the
Kanosuke Brand holds 94 Bottles and the Entity lists 100 in all, the other 6
being Kanosuke whisky under The Heart Cut, The Ghost Series, Whisky Mew, and
T&T Toyama.

## Entity and Series changes

- `E1775` Kanosuke Distillery was merged into `E1097`, which now reads
  `Kanosuke` with short name `Kanosuke`, the production-site address 845-3
  Kaminokawa, Hiyoshi-cho, Hioki, Kagoshima 899-2421, coordinates
  31.6037 N 130.3358 E (the OpenStreetMap node for the distillery), owner
  Komasa Jyozo `E366135`, and a description citing the November 2017 start,
  the August 2021 operating company, and the September 2021 Distill Ventures
  investment. Before the merge `E1097` was geocoded to Kaminokawa, Tochigi and
  `E1775` to Komasa's office.
- New Entities: `E367028` Hioki Distillery (distillery, owner Komasa Jyozo;
  distiller on the seven Hioki Pot Still and Double Distillery rows),
  `E367029` The Ghost Series (bottler, owner Nonjatta `E366715`), `E367030`
  Whisky Mew (bottler), `E367031` Glover Collection (bottler; its owner, the
  Whisky Culture Research Institute, has no Entity).
- New Series under Kanosuke: `S0938` Limited Edition (7), `S0939` Artist
  Edition (5), `S0940` Distillery Exclusive (10), `S0941` Component Series
  (4), `S0942` The Mellow Bar Reserve (3), `S0943` Distiller's Choice (4).
- Deleted, after moving their names to `edition`: `S0373` Brush Stroke (The
  Whisky Exchange's program name) and `S0424` The Awakening Series (Kirsch
  Import's program name).

## Brand, name, and Series decisions

These follow "Who Is The Brand, Series, And Bottler" in
`docs/architecture/whisky-identity-model.md`, which was written from this
review.

- Kanosuke `E1097` is the Brand and distiller of its own line (rule 1).
  Hioki Pot Still whisky keeps the Kanosuke Brand with Hioki Distillery as
  distiller (rule 6); its category is `single_pot_still` per the categories
  baseline (pot stills, malted and unmalted barley), and Double Distillery
  (malt plus pot still) is `blend`.
- Official expressions use the producer's title without the Brand:
  `Single Malt`, `Hioki Pot Still`, `Double Distillery`, `Single Malt Peated`,
  `Single Malt Kagoshima Exclusive`, `Single Malt Sherry Casks Vatted`,
  `Single Malt IPA Cask Finish`. Dated or numbered descriptors are the
  `edition`: `2021 First Edition`, `2023 Limited Edition`, `Artist Edition` +
  `#004`, `Distillery Exclusive` + `#010`, `Component Series` +
  `Ex-Sherry Cask`, `The Mellow Bar Reserve`, `Distillery Fest. 2025`.
- Casks bottled for a customer are official bottlings with no bottler (rule
  5): name `Single Cask <vintage> #<cask> [<age>-year-old]` as the source
  prints it, and the customer or program in `edition` (`for Isetan`,
  `Chichibu Whisky Matsuri 2025`, `Brush Stroke`, `The Awakening Series`,
  `A Pacific Ocean Collaboration`). Where a retailer sells under its own
  product title, that title is the name (`2020 1st Fill Bourbon Cask #20496`).
- Independent bottler labels are Brand and bottler (rule 4): The Heart Cut
  `B47573` (name `Kanosuke`, edition `#21`), The Ghost Series (editions
  `No. 16`, `No. 23a`, `No. 23b`, `No. 23c`), Whisky Mew (Drifters label), T&T
  Toyama, Glover Collection.
- The 2025 JAL Limited Edition package and the Conran Shop art label are the
  core Single Malt `B57458` and were added as Bottle references, not Bottles.
- Owner's Cask bottles that a bar or shop sold to the public were created
  (Bar Espace Rassurants `Legacy02`, Mizunara Owners Club); private or
  restaurant-only casks were left out of scope.
- Ages were stored only when printed; vintage ranges (2017–2019) stay null.
  Outturns with conflicting sources stay null: Whisky & Spirits Festival
  2026 Yokohama (organizer 240, reseller 252), Casa de Vinos 15th (retailer
  196, import reference 198), Crane & Sky #02 (organizer 235, label 234).
  US importer "bottles for the U.S." counts are allocations, not outturns.

## Corrections to existing records

- `B47285`: The Whisky Exchange's final Brush Stroke cask,
  `Kanosuke 2018 Bourbon Cask 19044 Peated`, 7 yo, 57%, first-fill bourbon,
  50 ppm, 156 bottles, August 2026. Bottler cleared; cask number and outturn
  added.
- `B47572`: Kirsch Import's Whisky Live Germany 2025 cask #19466, 57%, 108
  bottles, October 2025; the 2018 vintage was a retailer claim not on the
  label and was cleared.
- `B47573`: The Heart Cut #21, Nov 2019 to Apr 2025, quarter cask, 54%, 150
  bottles, from the bottler's page. Brand moved to The Heart Cut.
- `B52333` Artist Edition #002: vintage 2018 → 2019 (jpwhisky and whiskyfun),
  no printed age, released 15 March 2023, PX sherry butts.
- `B52406` 2022 Limited Edition: release date 24 June 2022 (moved from June 15
  after a label ABV misprint, per old-site news); bottler cleared.
- `B56976` 2021 First Edition: on sale 16 June 2021; label reads cask
  strength, non chill-filtered; no age statement.
- `B52451` Yokohama 2026 and `B52450` Taiwan Edition #18176: renamed to the
  single-cask pattern, bottler cleared, conflicting outturn cleared.
- `B47581` Casa de Vinos 15th: bottler cleared, category set, outturn cleared.
- `B52296` Takashimaya #19182: no primary page found; only the distiller
  Entity changed through the merge.

## Sources and coverage

- Producer: kanosuke.com Shopify product feeds and pages (JA and EN; ABV and
  size are on the page, not in the feed), the news and global-news blogs
  (2017–2026), the company page, and the trade-law page. The site was rebuilt
  in March 2025 and dropped most 2018–2024 product posts. The old WordPress
  site on the Wayback Machine supplied them: yearly news indexes
  `/news/<year>/`, the products index, and `/special/<slug>/` spec pages. The
  capture of `kanosuke.com/special/distillery_exclusive/` (2025-02-13) lists
  cask numbers, distillation and bottling months, and outturns for Distillery
  Exclusive #001–#010; other special pages gave exact on-sale dates for the
  2021–2024 editions, the core launches (2023-01-18, 2023-12-01, 2024-04-09),
  the Component Series (2024-08-12), and The Mellow Bar Reserve (mid-November
  2024).
- Producer press releases on Kyodo PR Wire: JAL Story 2024, Kagoshima
  Exclusive, Conran Shop, Sherry Casks Vatted, Whiskypedia 2026, festival 2024
  and 2026.
- Japanese Whisky Information Center timeline (jwic.jp/distillery/kanosuke,
  updated 2026-09-10) for the year of every family member.
- Dated release posts with specs: en.jpwhisky.net, nomunication.jp,
  88bamboo.co, whiskyfun.com (November 2023 session), whiskynotes.be,
  wordsofwhisky.com, whiskyadvocate.com, Whisky Magazine, Robb Report.
- Importers and retailers read directly: High Road Spirits (US; its label
  photo settled the K&L/Acorn cask as #18014 at 56% against the page text's
  18104 and resellers' 21494), The Heart Cut, AFTrade and Mizunara: The Shop
  (Hong Kong), The Liquor Shop, The Whisky Shop, Mande Drinks and Rare Malts
  & Co (Singapore), Kent Street Cellars (Australia), dekanta, whisky-nights.com
  (30 label readings), Imadeya, Shinanoya, Liquor Mountain, Whisky Talk
  Fukuoka, Lawson, Thompson Bros, Whisky Situation, Skurnik.
- Auction lots read: WVA Whisky Auctions, The Whisky Shop Auctions, Bonhams.
  Yahoo! Auctions Japan titles were leads only.
- Blocked to tools (leads from search snippets only): Whisky Auctioneer,
  Whiskybase, Whisky Hammer, The Whisky Exchange, K&L, Master of Malt, Casa de
  Vinos, Isetan, JAL press, Takashimaya.
- Not found: LMDW or Whisky Live Paris, Tokyo, Taipei, Hong Kong or Singapore
  exclusives; Scottish or Dutch independent bottlings other than Thompson
  Bros; Canadian, Dutch or Taiwanese importers; a Kanosuke Wikipedia article.
- Images: kanosuke.com publishes no reuse terms ("© KANOSUKE" only); High
  Road Spirits and The Heart Cut reserve all rights; Whisky Nights forbids
  reuse. No image was uploaded. The three pre-existing images (`B52406`,
  `B52450`, `B52451`) record no source page or license.

## Verification

Every patched Bottle was read immediately before and after its patch and the
stored values matched the work list with no mismatches. Every created Bottle
was re-fetched and compared field by field with its planned values: 90
checked, no differences. The six Series report 7, 5, 10, 4, 3, and 4 members.
The merged Entity was confirmed by fetching the old ID, which resolves to
`E1097`, and by the distiller Bottle count moving from 5 plus 6 to 11. Both
deleted Series were fetched with zero members first.

## Unresolved (19 rows)

Crane & Sky #01 (2021); Modern Malt Whisky Market 2021 cask 20049 (probably
Distillery Exclusive #001 sold at the fair); Whisky Lovers Nagoya 2023; Whisky
Festival 2023 cask 20030; Glover Collection "Ittoudai"; Whisky Messe Kyoto
2026; Nouveau Beginnings `B47559` (probably Casa de Vinos' Whisky Abbey 2024
sherry cask; its Casa de Vinos page is unreadable to tools); Thompson Bros
cask 20463 versus The Whisky Crew's "Japanese Trail" label on the same cask
(one or two Bottles); Isetan second cask; Imadeya #20373; Katsunuma; Sogo
Yokohama 40th; Bar Barns 22432; Bar Kitchen 20th; Madeira/Blandy's; two
Yahoo-only titles; Kyoto Fine Wine IPA cask; Bonhams single cask #20466. Each
row's note in the CSV states the open question and the searches tried.

## Follow-ups outside this scope

Found while checking precedent, not changed: five Ghost Series records under
Karuizawa, Ryuka and Time Slip use the older shape (distillery Brand, Ghost
Series Series, bottler Nonjatta); four empty per-distillery "Special
Releases" Series (`S0209`, `S0225`, `S0247`, `S0830`); Berry Bros & Rudd's
Awakening Series `S0432`; two Ledaig casks "exclusive to The Whisky Exchange"
with TWE as bottler; one Managers' Choice record under the Ardbeg Brand.
