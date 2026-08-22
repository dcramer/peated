# External Review Content Supply

Status: research notes, checked 2026-08-21. This is product and technical
research, not legal advice. Recheck every source before enabling ingestion.

## Product Intent

Peated should be a review index that sends readers to publishers, not a place
that republishes their work. A Bottle page may show:

- publisher, reviewer, publication date, and canonical URL;
- the publisher's score in its native scale;
- a Peated critic consensus derived from several published scores;
- a short, attributed Peated summary; and
- a prominent link to read the full review at the publisher.

Do not copy full tasting notes, conclusions, photographs, or article text. A
generated summary must describe the review without imitating or closely
paraphrasing the author's prose. It must remain attached to its source and be
removed or regenerated when the source changes.

This narrower display is part of the publisher value proposition, but it does
not override a site's terms, robots policy, copyright, or database rights.
RSS, a sitemap, and public crawlability are discovery mechanisms, not content
licenses.

## Acquisition Modes

| Mode            | Meaning                                                                  | Peated behavior                                                                    |
| --------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `public_index`  | Robots allow the planned paths and no reviewed public terms prohibit use | Index structured facts, generate enabled summaries, and link to the canonical page |
| `licensed_only` | Public terms prohibit bots, aggregation, copying, or database creation   | Do not crawl                                                                       |
| `do_not_ingest` | Robots, rate limits, or another site control blocks reliable access      | Do not work around the control                                                     |

Peated should identify itself with a stable user agent and contact URL, obey
robots rules and crawl delays, rate-limit requests, and honor takedowns. Public
terms can still prohibit collection when robots allow the requested path.

## Priority Ledger

The terms column records what was discoverable during this audit. "Not located"
means no dedicated terms page was found from the public site, footer, or a
site-specific search; it does not mean unrestricted use is allowed.

| Priority   | Source                                                        | Supply opportunity                                                                | robots.txt observation                                                                                     | Terms/reuse observation                                                                                                                           | Recommended mode                              |
| ---------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| P0         | [WhiskyNotes](https://www.whiskynotes.be/)                    | About 6,600 reviews across 4,985 articles; new tasting notes every weekday        | Public article paths allowed; feed, search, downloads, and WordPress internals disallowed                  | No dedicated terms page located                                                                                                                   | `public_index`, daily archive import          |
| P0         | [Whiskyfun](https://www.whiskyfun.com/)                       | About 22,700 whisky reviews dating to 2002                                        | No `Disallow` rule observed; unusual single `Allow` entry                                                  | No formal terms located; FAQ and disclosure discuss free commercial use                                                                           | `public_index`, later archive candidate       |
| P0         | [Dramface](https://www.dramface.com/)                         | Reviews most weekdays, multiple writers, frequent multi-bottle articles           | Public pages allowed; Squarespace rules block API, JSON, search, account, and other internal paths         | No dedicated terms page linked in the public footer                                                                                               | `public_index`, ongoing-feed pilot            |
| P0         | [Whisky Advocate](https://whiskyadvocate.com/ratings-reviews) | Existing Peated source; publisher describes an archive of more than 6,000 reviews | Ratings paths allowed for general crawlers; GPTBot, ChatGPT-User, and CCBot are blocked                    | Privacy policy references general terms, but no public general terms page or review-reuse restriction was located                                 | `public_index`, second bounded pilot          |
| P0         | [Whisky Saga](https://www.whiskysaga.com/)                    | Active scored reviews; the Scotland category contains more than 2,000 articles    | Public category and article paths allowed; Squarespace APIs, search, filters, and internal formats blocked | Privacy and editorial pages contain no automated-access restriction                                                                               | `public_index`, daily Scotch feed             |
| P1         | [Whisky Magazine](https://www.whiskymag.com/search/tastings/) | Structured tasting archive spanning more than 200 magazine issues                 | Verification failed because the server reset the automated request                                         | Terms prohibit automated access, aggregation, and commercial reuse without written permission                                                     | `licensed_only`                               |
| P1         | [Malt](https://malt-review.com/)                              | Large historical review archive with multiple contributors                        | Automated requests returned HTTP 429 during the audit                                                      | No current terms page verified because automated access was rate-limited                                                                          | `do_not_ingest`; do not work around the block |
| P1         | [Breaking Bourbon](https://www.breakingbourbon.com/)          | Deep American whiskey archive with structured ratings and reviewers               | robots file exposes a sitemap and no reviewed article-path restriction                                     | Terms prohibit robots, spiders, retrieval/indexing applications, and reuse without written consent                                                | `licensed_only`                               |
| P1         | [The Whiskey Wash](https://thewhiskeywash.com/)               | High-cadence reviews and release news                                             | Public articles allowed; administrative, search, feed, and implementation paths restricted                 | Terms prohibit unauthorized robots, spiders, scrapers, and derivative works                                                                       | `licensed_only`                               |
| P1         | [Words of Whisky](https://wordsofwhisky.com/)                 | Active scored reviews, including multi-bottle articles                            | Public pages allowed; WordPress administration restricted                                                  | No dedicated terms page located; footer reserves rights                                                                                           | `public_index`                                |
| P2         | [The Whiskey Reviewer](https://whiskeyreviewer.com/)          | Long-running American and world whiskey review archive                            | Public pages allowed; WordPress administration restricted                                                  | No dedicated reuse terms located                                                                                                                  | `public_index`                                |
| P2         | [Fred Minnick](https://www.fredminnick.com/)                  | Infrequent current American whiskey reviews among a high-volume news stream       | Public content allowed with a 30-second crawl delay; calendar implementation paths restricted              | No dedicated terms page located; the linked privacy page contains placeholder text                                                                | `public_index`; bounded review feed           |
| P2         | [Bourbon Culture](https://thebourbonculture.com/)             | Active scored bourbon and American whiskey reviews                                | File defines Cloudflare content-signal semantics but publishes no actual allow/deny signal                 | Public privacy page contains no automated-access or content-reuse restriction; no dedicated terms page located                                    | `public_index`, daily feed                    |
| P3         | [The Scotch Noob](https://scotchnoob.com/)                    | Useful historical backfill through 2023; little current supply                    | Explicitly allows all pages and publishes a sitemap                                                        | No dedicated reuse terms located                                                                                                                  | `public_index`, low priority because inactive |
| Restricted | [Whiskybase](https://www.whiskybase.com/)                     | Millions of community ratings plus bottle identity data                           | robots request returned HTTP 403 during the audit                                                          | Terms prohibit collection, copying, public display, commercial reuse, archiving, and derivative works; copyright and database rights are asserted | `licensed_only`; do not crawl                 |
| Restricted | [Distiller](https://distiller.com/)                           | Large editorial and community review database                                     | Only `/data-admin` is disallowed and a sitemap is published                                                | Terms prohibit scraping, indexing, database building, permanent copies, and commercial exploitation                                               | `licensed_only`; do not crawl                 |

Secondary candidates for a later audit include Whisky.com, YouTube reviewers,
podcasts, and official distillery newsrooms. Video and podcast transcripts need
a separate platform-terms and creator-rights review.

## Source Notes

### WhiskyNotes

- Evidence: [homepage and stated archive size](https://www.whiskynotes.be/),
  [about and contact](https://www.whiskynotes.be/about-whiskynotes/), and
  [robots.txt](https://www.whiskynotes.be/robots.txt).
- Pages are structured enough to identify author/date, bottle specifications,
  sections, and score. One document may review several bottles.
- The feed is explicitly disallowed in robots.txt, so do not treat WordPress
  feed discovery as an ingestion path. Use only allowed article pages.
- The daily importer checks the current page and advances at most four older
  archive pages from its last successful cursor. It stops older-page requests
  when the public archive ends.

### Whiskyfun

- Evidence: [homepage and archive](https://www.whiskyfun.com/),
  [FAQ and contact](https://www.whiskyfun.com/faq.html),
  [FTC disclosure](https://www.whiskyfun.com/FTC-disclosure.html), and
  [robots.txt](https://www.whiskyfun.com/robots.txt).
- This is the largest independent editorial archive in the first audit.
  Sessions frequently contain several reviews on one legacy HTML page.
- The FAQ says the author is comfortable with some free use of notes and scores
  by commercial entities.
- The current RSS feed supplies canonical article URLs, titles, exact dates,
  and Bottle names. Article pages supply the reviewer and native 100-point
  scores.
- The implemented daily feed checks at most 20 items and uses the governed
  runtime for article requests. The two-decade archive remains a separate
  future backfill.

### Whisky Saga

- Evidence: [Scotland reviews](https://www.whiskysaga.com/blog/category/Scotland),
  [editorial standards](https://www.whiskysaga.com/editorial-standards),
  [privacy policy](https://www.whiskysaga.com/privacy), and
  [robots.txt](https://www.whiskysaga.com/robots.txt).
- Rechecked on 2026-08-21. Robots allow the public Scotland category and
  article paths. They block Squarespace APIs, search, query filters, and
  internal formats. The public privacy and editorial pages contain no
  automated-access restriction.
- The Scotland category contains more than 2,000 articles and displays 20
  current posts. Review articles expose an exact timestamp, author, Bottle
  title, direct tasting sections, and a 100-point score.
- The implemented daily feed reads only the 20 current Scotland article cards.
  It does not use the full sitemap, archive pagination, search, query filters,
  or Squarespace APIs. Only direct nose, taste, palate, and finish paragraphs
  stay transient for summary generation.

### Dramface

- Evidence: [homepage and cadence](https://www.dramface.com/),
  [about](https://www.dramface.com/about-us),
  [contact](https://www.dramface.com/contact), and
  [robots.txt](https://www.dramface.com/robots.txt).
- The public review structure exposes author, score, bottle facts, and a short
  `TL;DR`, but Peated should not assume that the existing summary is reusable.
- Multi-bottle and multi-author articles make it a good test for the required
  review-article model.
- The implemented daily feed reads at most 20 links from the public review
  index. It uses only allowed article paths through the governed runtime. It
  keeps each Bottle and reviewer section separate and excludes Dramface's
  `TL;DR` text from transient summary input.
- Dramface also republishes press releases in a clearly labeled news section.
  Use that as discovery; release facts should link to the original producer or
  issuer when available.

### Whisky Advocate

- Evidence: [ratings archive](https://whiskyadvocate.com/ratings-reviews),
  [privacy policy](https://whiskyadvocate.com/Privacy-Policy), and
  [robots.txt](https://whiskyadvocate.com/robots.txt).
- Rechecked on 2026-08-20. The general crawler group allows the ratings paths.
  It blocks tracking-query variants and separately blocks GPTBot,
  ChatGPT-User, and CCBot. Peated uses its own identified crawler and does not
  request the blocked query variants.
- The privacy policy was last modified on 2026-04-01. It references general
  Terms of Service, but no public general terms page was linked or found. No
  reviewed page prohibited the planned metadata indexing and canonical links.
- Peated already has more than 7,000 stored review rows. The second pilot reads
  the issue index, newest issue, and listed review pages. Review pages provide
  explicit publication dates. Peated does not persist review prose or generate
  summaries from it.

### Words of Whisky

- Evidence: [homepage and current reviews](https://wordsofwhisky.com/),
  [tasting-notes index](https://wordsofwhisky.com/tasting-notes/), and
  [robots.txt](https://wordsofwhisky.com/robots.txt).
- Rechecked on 2026-08-21. Robots rules block WordPress administration and
  allow the public homepage and article paths. No dedicated terms or privacy
  page is linked from the public site. The footer reserves rights.
- Current article pages expose an exact timestamp, writer, Bottle headings,
  tasting notes, publisher conclusions, and per-Bottle 10-point scores.
- The implemented daily feed reads at most 20 current tasting-note articles
  from the homepage. It does not use the full archive, RSS, WordPress APIs,
  search, or load-more endpoints. It keeps multi-bottle sections separate and
  excludes article introductions and publisher conclusions from transient
  summary input.

### The Whiskey Reviewer

- Evidence: [homepage and current reviews](https://whiskeyreviewer.com/),
  [review archive](https://whiskeyreviewer.com/whiskey-reviews/),
  [privacy policy](https://whiskeyreviewer.com/privacy-policy/), and
  [robots.txt](https://whiskeyreviewer.com/robots.txt).
- Rechecked on 2026-08-21. Robots rules block WordPress administration and
  allow the public homepage and article paths. The public privacy page contains
  no automated-access or content-reuse restriction. No dedicated terms page is
  linked from the public site. The footer reserves rights.
- Current article pages expose a canonical link, writer, Bottle title, and
  letter grade. Current URLs usually encode the publication date.
- The implemented daily feed reads only the five links in the homepage Recent
  Reviews list. It does not use the alphabetical archive, category pages,
  sitemaps, feeds, search, or WordPress APIs. It excludes introductions, price
  text, and publisher conclusions from transient summary input.

### Bourbon Culture

- Evidence: [homepage and latest reviews](https://thebourbonculture.com/),
  [privacy policy](https://thebourbonculture.com/privacy-policy/), and
  [robots.txt](https://thebourbonculture.com/robots.txt).
- Rechecked on 2026-08-21. The robots file describes Cloudflare content signals
  but publishes no allow or deny signal and no path rule. The public privacy
  page contains no automated-access or content-reuse restriction. No dedicated
  terms page is linked from the public site.
- Current article pages expose a canonical link, writer, exact publication
  timestamp, Bottle title, tasting-note section, and 10-point score.
- The implemented daily feed reads only the six links under Latest Whiskey
  Reviews on the homepage. It does not use archives, ratings pages, sitemaps,
  feeds, search, or WordPress APIs. It excludes introductions and publisher
  conclusions from transient summary input.

### Fred Minnick

- Evidence: [homepage and public sitemap](https://www.fredminnick.com/),
  [disclosures](https://www.fredminnick.com/elementor-9293/), and
  [robots.txt](https://www.fredminnick.com/robots.txt).
- Rechecked on 2026-08-21. Robots allows public posts and sitemaps, requires a
  30-second crawl delay, and restricts calendar implementation paths. No
  dedicated terms page was linked or located. The linked privacy page contains
  placeholder text and states no automated-access or reuse restriction.
- The public Reviews page is empty. The main RSS feed is limited and usually
  contains news rather than reviews. Current review articles appear as normal
  posts and do not publish a stable numeric or letter score.
- The implemented daily feed reads the sitemap index and only the newest two
  post sitemaps. It selects at most five single-Bottle review URLs and skips
  comparisons. It stores explicit dates, canonical links, and Fred Minnick as
  the reviewer. Native scores stay absent. Only direct tasting paragraphs stay
  transient for summary generation.

### Explicitly Restricted Sources

- [Breaking Bourbon terms](https://www.breakingbourbon.com/site/breaking-bourbon-terms-of-use-agreement)
  prohibit automated retrieval/indexing and reserve reuse.
- [The Whiskey Wash terms](https://thewhiskeywash.com/about/terms-of-use/)
  prohibit unauthorized automated access and derivative works.
- [Whisky Magazine terms](https://www.whiskymag.com/terms-conditions/)
  prohibit automated access, aggregation, and commercial reuse without
  permission.
- [Whiskybase terms](https://www.whiskybase.com/page/marketplace-wbterms)
  expressly cover bottle information, descriptions, reviews, ratings, and
  prices, and assert database rights.
- [Distiller terms](https://distiller.com/terms-of-service) prohibit scraping,
  indexing, building databases, and keeping permanent copies.

Do not build source-specific crawlers for these publishers while their public
terms prohibit the planned use. A public sitemap or permissive robots file does
not negate those terms.

## Implemented Product Boundary

The external-review feature now has the required article/review model, content
policy, governed fetch boundary, and Bottle-page presentation. See
the [external review indexing guide](../features/external-review-indexing.md)
for the current contract and pilot procedure.

The pilot started with these limits:

- `review.url` was globally unique, so one multi-bottle article could not own
  several independent Bottle reviews.
- Every review required a 0-100 score and an issue name.
- Reviews had no author, publication date, article title, native score scale,
  summary, source evidence, rights mode, or source-policy version.
- There was no review-article record separate from a Bottle review.
- Outbound requests did not use one governed runtime with request budgets,
  robots checks, and durable runs.

Relevant implementation:

- [`reviews` schema](../../apps/server/src/db/schema/reviews.ts)
- [review-source policy](../../apps/server/src/db/schema/externalReviewSources.ts)
- [article observation contract](../../apps/server/src/externalReviews/observation.ts)
- [external review ingestion](../../apps/server/src/externalReviews/ingest.ts)
- [scraper runtime](../../apps/server/src/scraper/README.md)

The current model separates:

- a source and its content-processing/display policy;
- a review article identified by publisher and canonical URL;
- zero or more scored or unscored Bottle reviews from that article; and
- a short generated summary with model provenance and source evidence.

Add later publishers through source-specific adapters. Do not replace them
with a generalized crawler unless repeated source work proves a smaller shared
boundary.

## Source Sequence

1. WhiskyNotes supplies the first resumable historical archive import and a
   daily current feed.
2. Whisky Advocate supplies the existing large scored archive and current
   issue.
3. Whiskyfun supplies the next daily multi-bottle feed. Keep its historical
   archive as a later bounded change.
4. Dramface supplies the next daily multi-bottle and multi-writer feed.
5. Words of Whisky supplies the next daily multi-bottle feed.
6. The Whiskey Reviewer supplies the next daily American whiskey feed.
7. Bourbon Culture supplies the next daily American whiskey feed.
8. Fred Minnick supplies a low-cadence daily American whiskey review feed.
9. Whisky Saga supplies the next daily Scotch review feed.
10. Continue through the reviewed public-index candidates until Peated has at
    least 12 reliable feeds.

The pilot is successful with at least 90% article extraction accuracy on a
reviewed sample, reliable splitting of multi-bottle articles, measurable
Bottle-match yield, and a display contract that clearly sends readers to the
publisher.

## Policy References

- [Google's robots.txt overview](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
  explains robots.txt as crawler-access and traffic control, not a content
  license.
- [U.S. Copyright Office fair-use guidance](https://copyright.gov/fair-use/)
  emphasizes that fair use is case-specific and considers market substitution.
- [EU Directive 2019/790](https://eur-lex.europa.eu/eli/dir/2019/790/oj)
  includes the text-and-data-mining reservation framework relevant to European
  publishers.

Terms and robots policies can change. Recheck them before materially changing
what Peated collects or displays.
