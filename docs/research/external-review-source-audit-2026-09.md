# External Review Source Audit — September 2026

Audit date: 2026-09-08. This is research, not legal advice or a permanent
permission record. Recheck robots rules and public terms before enabling or
materially changing collection.

This pass looked for small, active whisky publications that expose a bounded
server-rendered review index. Sources stay unpublished until a production
preview passes and an administrator reviews the hidden Bottle matches.

## Candidate Ledger

| Source                                                             | Access and reuse check                                                                                                                                                | Review structure                                                                                                         | Production decision                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [WhiskyRant](https://www.whiskyrant.com/)                          | Public review pages allowed; no dedicated terms page located                                                                                                          | Single-Bottle articles with dates, author, tasting notes, and scores                                                     | Source 39 is published and scheduled weekly. Two production runs completed without request errors, retries, or rate limits.                                                                                                                                                                                                                                               |
| [Bourbon With The Boys](https://bourbonwiththeboys.com/reviews)    | `robots.txt` allows public pages and declares `search=yes`, `use=reference`, and `ai-train=no`; no dedicated terms page located                                       | Eight current entries have exact dates and aggregate 8-point scores; older entries omit required dates                   | Source 41 uses rule revision 91. Preview run 710 passed eight reviews in nine requests. Collection run 711 stored all eight without errors, retries, or rate limits. Five exact Bottle matches were verified; three remain unmatched. Keep unpublished while score conversion is reviewed.                                                                                |
| [Dram1](https://dram1.com/whisky-reviews/)                         | Public review paths allowed; no automated-access prohibition found in the reviewed service terms                                                                      | Twenty current links per page; articles expose Bottle titles, author, body, and dates in Schema.org JSON-LD              | Source 40 stays disabled. Local rules pass after adding generic JSON-LD date support; production activation must wait for that parser change to deploy and pass a fresh preview.                                                                                                                                                                                          |
| [Single Malt Snob](https://www.singlemaltsnob.com/drinking-whisky) | Squarespace robots rules allow the public review index and articles while blocking APIs, search, internal formats, and query filters; no dedicated terms page located | Twenty current single-Bottle review cards with exact metadata and one article body                                       | Source 45 uses conservative rule revision 94, limited to the five current entries. Preview run 716 passed. Hidden collection run 717 stored all five in six requests without errors, retries, or rate limits. All remain unmatched; keep unpublished and unscheduled pending identity review.                                                                             |
| [Let's Drink Scotch](https://letsdrinkscotch.blogspot.com/)        | Blogger robots rules allow public pages and block search and share-widget paths; no site-specific terms page located                                                  | Current posts expose Bottle titles, exact timestamps, author, and review body; older posts include multi-Bottle roundups | Source 46 uses manual rule revision 95, limited to the five current single-Bottle entries without following the blocked search-based older-posts link. Preview run 720 and hidden collection run 722 each completed in six requests without errors, retries, or rate limits. All five reviews remain unmatched; keep unpublished and unscheduled pending identity review. |
| [Bourbon Bossman](https://bourbonbossman.com/bourbon-reviews/)     | WordPress robots rules allow the public review index and articles; no automated-access prohibition found in the public pages reviewed                                 | Eight current server-rendered single-Bottle reviews with exact dates, author, tasting notes, and categorical ratings     | Source 47 is disabled and unpublished. AI setup run 721 failed rule validation. Manual revision 96 conservatively limits collection to the five newest conventional reviews and is pending preview. Its generic leading `Review of` title cleanup was added in this pass; wait for deployment and a fresh production preview before activation.                           |
| [Whiskey Knucklehead](https://www.whiskeyknucklehead.com/blog)     | `robots.txt` allows public pages for search/reference use and excludes model training                                                                                 | Thirty-one dedicated single-Bottle review pages with exact timestamps and one article body                               | Source 44 remains disabled and unpublished. Peated's production crawler received HTTP 403; do not work around the block.                                                                                                                                                                                                                                                  |
| [Whiskey Network](https://whiskeynetwork.net/)                     | Public review paths are allowed                                                                                                                                       | Dedicated review archive                                                                                                 | Source 42 remains disabled and unpublished. Peated's production setup received HTTP 403; do not work around the block.                                                                                                                                                                                                                                                    |
| WHISKY:EDITION                                                     | The former site stated CC BY 4.0 reuse, but its reviewed review index and sample URLs now return HTTP 404                                                             | Formerly a large structured scored archive                                                                               | Source 43 remains disabled and unpublished. Do not collect from stale search-engine copies.                                                                                                                                                                                                                                                                               |

## Excluded Candidates

- [Mostly Bourbon](https://mostlybourbon.com/all-reviews/) has an excellent
  143-review table, but its public terms prohibit systematic retrieval,
  automated use, data-mining tools, robots, and scrapers. Do not crawl without
  written permission.
- [People's Bourbon Review](https://www.peoplesbourbonreview.com/) publicly
  prohibits scraping, mirroring, and copying without written permission.
- [Bourbon Critics](https://bourboncritics.com/) allows public pages in
  `robots.txt`, but its review grid is populated only by client-side JavaScript
  and cannot be read by the current selector-based scraper.
- [Parker's Whisky](https://parkerswhisky.com/reviews/) allows public pages, but
  its dedicated review index contains no server-rendered review links.
- [Whisky Centurion](https://www.whiskycenturion.com/blog) is active and allows
  public pages, but its single feed mixes reviews, news, and essays without a
  stable structural review marker.
- [Bourbon Paddy](https://bourbonpaddy.com/category/reviews/bourbon-reviews/)
  has dedicated category archives, but recent pages include multi-Bottle reviews
  that need a verified item-level rule before registration.
- [More Drams, Less Drama](https://moredramslessdrama.com/) is active and highly
  structured inside articles, but most current articles review several Bottles.
  Its heading-delimited item extraction needs a separate preview pass.

## Parser Follow-up

Many small publishers put the only complete publication timestamp in
Schema.org JSON-LD. The configured parser now checks bounded, valid JSON-LD
after its existing meta-tag and `<time>` fallbacks. This is a generic metadata
fallback, not a Dram1-specific rule.

The Bourbon With The Boys matcher initially assigned the unspecified Lucky
Seven “The Workhorse” review to Peated's Batch 01 Bottle. The source does not
state a batch, so review 10799 was returned to unmatched rather than preserving
an unsupported exact-release claim.
