# External Review Content Supply

Status: research notes, checked 2026-08-18. This is product and technical
research, not legal advice. Recheck every source before enabling ingestion and
have counsel approve the final collection and display policy.

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

| Mode                  | Meaning                                                                   | Peated behavior                                                                           |
| --------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `partner_feed`        | Publisher has granted written permission or supplied a feed/export        | Ingest only the approved fields and display them under the agreement                      |
| `index_only`          | Counsel has approved indexing without a publisher agreement               | Show canonical metadata and a link; do not generate a summary unless that use is approved |
| `permission_required` | Terms are silent, ambiguous, or signal concern about automated or AI use  | Contact the publisher before systematic collection                                        |
| `licensed_only`       | Terms expressly prohibit bots, aggregation, copying, or database creation | Do not crawl; pursue an API, export, or written license                                   |
| `do_not_ingest`       | The publisher declines or no compliant path exists                        | Retain only the source-level audit record                                                 |

Peated should identify itself with a stable user agent and contact URL, obey
robots rules and crawl delays, rate-limit requests, honor takedowns, and record
the policy version used by each ingestion run. A permissive robots file does
not by itself move a source out of `permission_required`.

## Priority Ledger

The terms column records what was discoverable during this audit. "Not located"
means no dedicated terms page was found from the public site, footer, or a
site-specific search; it does not mean unrestricted use is allowed.

| Priority   | Source                                                        | Supply opportunity                                                                | robots.txt observation                                                                             | Terms/reuse observation                                                                                                                           | Recommended mode                                     |
| ---------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| P0         | [WhiskyNotes](https://www.whiskynotes.be/)                    | About 6,600 reviews across 4,985 articles; new tasting notes every weekday        | Public article paths allowed; feed, search, downloads, and WordPress internals disallowed          | No dedicated terms page located; public contact available                                                                                         | `permission_required`, target first partner pilot    |
| P0         | [Whiskyfun](https://www.whiskyfun.com/)                       | About 22,700 whisky reviews dating to 2002                                        | No `Disallow` rule observed; unusual single `Allow` entry                                          | No formal terms located; FAQ and disclosure discuss free commercial use, but do not provide Peated-specific permission                            | `permission_required`, request archive export        |
| P0         | [Dramface](https://www.dramface.com/)                         | Reviews most weekdays, multiple writers, frequent multi-bottle articles           | Public pages allowed; Squarespace rules block API, JSON, search, account, and other internal paths | No dedicated terms page linked in the public footer; contact page available                                                                       | `permission_required`, target ongoing-feed pilot     |
| P0         | [Whisky Advocate](https://whiskyadvocate.com/ratings-reviews) | Existing Peated source; publisher describes an archive of more than 6,000 reviews | General crawler access allowed, but GPTBot, ChatGPT-User, and CCBot are blocked                    | Public privacy policy references Terms of Service; no review-reuse permission located                                                             | `permission_required`; pause expansion               |
| P1         | [Whisky Magazine](https://www.whiskymag.com/search/tastings/) | Structured tasting archive spanning more than 200 magazine issues                 | Verification failed because the server reset the automated request                                 | Terms prohibit automated access, aggregation, and commercial reuse without written permission                                                     | `licensed_only`                                      |
| P1         | [Malt](https://malt-review.com/)                              | Large historical review archive with multiple contributors                        | Automated requests returned HTTP 429 during the audit                                              | No current terms page verified because automated access was rate-limited                                                                          | `permission_required`; do not work around the block  |
| P1         | [Breaking Bourbon](https://www.breakingbourbon.com/)          | Deep American whiskey archive with structured ratings and reviewers               | robots file exposes a sitemap and no reviewed article-path restriction                             | Terms prohibit robots, spiders, retrieval/indexing applications, and reuse without written consent                                                | `licensed_only`                                      |
| P1         | [The Whiskey Wash](https://thewhiskeywash.com/)               | High-cadence reviews and release news                                             | Public articles allowed; administrative, search, feed, and implementation paths restricted         | Terms prohibit unauthorized robots, spiders, scrapers, and derivative works                                                                       | `licensed_only`                                      |
| P1         | [Words of Whisky](https://wordsofwhisky.com/)                 | Active scored reviews, including multi-bottle articles                            | Public pages allowed; WordPress administration restricted                                          | No dedicated terms page located; footer reserves rights and a direct contact is published                                                         | `permission_required`                                |
| P2         | [The Whiskey Reviewer](https://whiskeyreviewer.com/)          | Long-running American and world whiskey review archive                            | Public pages allowed; WordPress administration restricted                                          | No dedicated reuse terms located                                                                                                                  | `permission_required`                                |
| P2         | [Fred Minnick](https://www.fredminnick.com/)                  | Reviews, rankings, and American whiskey news                                      | Public content not disallowed; 30-second crawl delay; calendar implementation paths restricted     | No reuse permission verified                                                                                                                      | `permission_required`                                |
| P2         | [The Bourbon Culture](https://thebourbonculture.com/)         | Bourbon reviews and comparisons                                                   | File defines Cloudflare content-signal semantics but publishes no actual allow/deny signal         | No reuse permission verified                                                                                                                      | `permission_required`                                |
| P3         | [The Scotch Noob](https://scotchnoob.com/)                    | Useful historical backfill through 2023; little current supply                    | Explicitly allows all pages and publishes a sitemap                                                | No dedicated reuse terms located                                                                                                                  | `permission_required`, low priority because inactive |
| Restricted | [Whiskybase](https://www.whiskybase.com/)                     | Millions of community ratings plus bottle identity data                           | robots request returned HTTP 403 during the audit                                                  | Terms prohibit collection, copying, public display, commercial reuse, archiving, and derivative works; copyright and database rights are asserted | `licensed_only`; partnership/API conversation only   |
| Restricted | [Distiller](https://distiller.com/)                           | Large editorial and community review database                                     | Only `/data-admin` is disallowed and a sitemap is published                                        | Terms prohibit scraping, indexing, database building, permanent copies, and commercial exploitation                                               | `licensed_only`; partnership/API conversation only   |

Secondary candidates for a later audit include Whisky Saga, Whisky.com,
YouTube reviewers, podcasts, and official distillery newsrooms. Video and
podcast transcripts need a separate platform-terms and creator-rights review.

## Source Notes

### WhiskyNotes

- Evidence: [homepage and stated archive size](https://www.whiskynotes.be/),
  [about and contact](https://www.whiskynotes.be/about-whiskynotes/), and
  [robots.txt](https://www.whiskynotes.be/robots.txt).
- Pages are structured enough to identify author/date, bottle specifications,
  sections, and score. One document may review several bottles.
- The feed is explicitly disallowed in robots.txt, so do not treat WordPress
  feed discovery as an approved ingestion path.
- Ask for an archive export or private feed containing canonical URL, title,
  publication date, reviewed bottle names/specifications, and native scores.

### Whiskyfun

- Evidence: [homepage and archive](https://www.whiskyfun.com/),
  [FAQ and contact](https://www.whiskyfun.com/faq.html),
  [FTC disclosure](https://www.whiskyfun.com/FTC-disclosure.html), and
  [robots.txt](https://www.whiskyfun.com/robots.txt).
- This is the largest independent editorial archive in the first audit.
  Sessions frequently contain several reviews on one legacy HTML page.
- The FAQ says the author is comfortable with some free use of notes and scores
  by commercial entities. That makes outreach promising, but Peated should get
  explicit permission for systematic collection and AI summarization.
- Prefer an author-provided export. Crawling more than two decades of legacy
  pages should be the fallback, not the opening request.

### Dramface

- Evidence: [homepage and cadence](https://www.dramface.com/),
  [about](https://www.dramface.com/about-us),
  [contact](https://www.dramface.com/contact), and
  [robots.txt](https://www.dramface.com/robots.txt).
- The public review structure exposes author, score, bottle facts, and a short
  `TL;DR`, but Peated should not assume that the existing summary is reusable.
- Multi-bottle and multi-author articles make it a good test for the required
  source-document model.
- Dramface also republishes press releases in a clearly labeled news section.
  Use that as discovery; release facts should link to the original producer or
  issuer when available.

### Whisky Advocate

- Evidence: [ratings archive](https://whiskyadvocate.com/ratings-reviews),
  [privacy policy](https://whiskyadvocate.com/Privacy-Policy), and
  [robots.txt](https://whiskyadvocate.com/robots.txt).
- Peated already has a dedicated issue scraper and thousands of stored review
  rows. Before expanding or generating summaries, confirm that the current use
  is consistent with the publisher's present terms and AI crawler signals.
- A partnership could replace brittle issue-page scraping with a complete
  archive export and stable ongoing feed.

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

Do not build source-specific crawlers for these publishers before receiving
written permission. A public sitemap or permissive robots file does not negate
their terms.

## Publisher Request

Ask each publisher for permission to:

1. ingest its public archive and future reviews through an export, private
   feed, or rate-limited crawler;
2. store canonical metadata, bottle associations, author, date, and native
   score;
3. use article text transiently as LLM input to produce a two- or
   three-sentence attributed summary;
4. display that summary beside a prominent canonical link; and
5. refresh or remove records when requested.

Offer prominent attribution, no copied images or full tasting notes, canonical
links, referral analytics, an immediate opt-out, and correction/removal tools.
Ask separately whether raw article text may be retained; default to transient
processing with no long-term raw-text storage.

Suggested outreach:

> Peated is building bottle pages that help whisky drinkers discover trusted
> reviews. We would show your publication, reviewer, date, native score, and a
> short attributed Peated summary, followed by a prominent link to read the
> full review on your site. We would not republish your review or photography.
> Would you permit us to index your archive and future reviews, and to process
> the article text solely to generate that summary? We can use an export or
> private feed if you prefer, honor updates and removals, and share referral
> traffic data.

## Required Product Boundary

The current implementation cannot represent this product cleanly:

- `review.url` is globally unique, so one multi-bottle article cannot own
  several independent review observations.
- Every review requires a 0-100 score and an issue name.
- Reviews have no author, publication date, article title, native score scale,
  summary, source evidence, rights mode, or source-policy version.
- There is no source-document record separate from a bottle review.
- Publisher registration and job dispatch are code-owned, which makes a large
  and changing source portfolio expensive to operate.

Relevant code:

- [`reviews` schema](../../apps/server/src/db/schema/reviews.ts)
- [Whisky Advocate scraper](../../apps/server/src/worker/jobs/scrapeWhiskyAdvocate.ts)
- [external review ingestion](../../apps/server/src/lib/createExternalReview.ts)

The eventual model should separate:

- a source and its acquisition/display policy;
- a source document identified by publisher and canonical URL;
- zero or more scored or unscored bottle-review observations from that
  document; and
- a short generated summary with model provenance and source evidence.

Do not design the full generalized pipeline until two publishers validate the
content and permission model.

## Recommended First Pilot

1. Contact WhiskyNotes, Whiskyfun, and Dramface in parallel.
2. Use WhiskyNotes as the preferred archive pilot because it combines meaningful
   volume, current cadence, clear bottle specifications, and a public contact.
3. Use Dramface as the preferred ongoing-feed and multi-bottle-document pilot.
4. Treat Whiskyfun as the high-volume backfill target, ideally through an
   author-provided export.
5. Review the existing Whisky Advocate ingestion with counsel and the publisher
   before adding summaries or attempting a full backfill.

The pilot is successful when Peated has written permission, at least 90%
document extraction accuracy on a reviewed sample, reliable splitting of
multi-bottle articles, measurable Bottle-match yield, and a display contract
that clearly sends readers to the publisher.

## Policy References

- [Google's robots.txt overview](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
  explains robots.txt as crawler-access and traffic control, not a content
  license.
- [U.S. Copyright Office fair-use guidance](https://copyright.gov/fair-use/)
  emphasizes that fair use is case-specific and considers market substitution.
- [EU Directive 2019/790](https://eur-lex.europa.eu/eli/dir/2019/790/oj)
  includes the text-and-data-mining reservation framework relevant to European
  publishers.

Terms, robots policies, and publisher preferences can change. Store the last
reviewed date and evidence URL with each production source, and require a fresh
policy review before materially changing what Peated collects or displays.
