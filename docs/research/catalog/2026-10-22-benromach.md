# Benromach catalog sources

Research date: 22 October 2026. Scope: the Benromach distillery record and
official Benromach releases. This guide does not claim full coverage of past
releases.

## Producer site

The [current range](https://www.benromach.com/whisky/current-range) lists
the Signature ages (10, 12, 15, 21, and 25 years), the current Cask
Strength Vintage batch, the Contrasts series, limited releases, single
casks, and the Ultra Aged range. The
[archive](https://www.benromach.com/whisky/archive) lists past Cask Strength
Vintage batches from 2009 to 2014, past Contrasts releases, single casks,
market exclusives, and releases from before the 2020 rebrand, including
Heritage single casks from 1973, 1975, and 1977. Each card links to a
product page at `/whisky/<slug>` with ABV, vintage, cask type, and often
the distillation and bottling years.

The site calls the distillery both "Benromach" and "Benromach Distillery".
They are one site in Forres, owned by Gordon & MacPhail since 1993.

## Access

WebFetch gets a 403 from benromach.com. Normal page loads in a browser work.
In-page `fetch()` calls stalled when the browser pane was hidden, so read
one page at a time.

## How the producer titles releases

- Contrasts releases are titled `Contrasts: <name>`, such as
  `Contrasts: Unpeated` or `Contrasts: Wine Finish Côte Rôtie Cask`. The
  site calls them "the Benromach Contrasts series". Before 2020 the same
  range was called the "Contrast Range", and its titles had no prefix:
  `Organic`, `Peat Smoke`, `Sassicaia`.
- Some Contrasts products, such as Organic and Peat Smoke, are sold as
  separate vintages under one product page. The page offers a choice of
  vintage (Organic shows 2015 and 2011).
- Single casks are titled with their vintage: `Single Cask (2003)`,
  `Single Cask 2011`, `Single Cask Bordeaux 2012`. The cask number appears
  in the description.
- Cask Strength Vintage releases are titled `Cask Strength Vintage` with
  `Vintage <year> - Batch <n>`. Older batches are written `Batch 1 - 2009`.
- The 40 Year Old is sold as yearly releases: `2021 Release` and
  `2022 Release Batch 2` (56.5%).
- `Small Batch Edition #1` is "the first edition of the Benromach Small
  Batch series". It is a 22 Years Old, distilled in 2003 and bottled in 2025.

## Open questions

- Whether a Contrasts Bottle's name should keep the `Contrasts:` prefix when
  the Bottle is in the Contrasts series. The producer's titles keep it.
- Which vintages of Organic and Peat Smoke were released, and whether each
  label prints its vintage. Only the current page's vintage choice was seen.
- Which 40 Year Old release is the 57.6% bottling. The site shows the 2021
  Release and the 2022 Release Batch 2, but did not give the 2021 ABV in
  the text read.
- Distillery-exclusive and retailer single casks, such as single bourbon
  barrels, are not on the producer site. Use auction records or label
  photos.
