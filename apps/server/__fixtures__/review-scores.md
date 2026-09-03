# Captured review score fixtures

Captured September 3, 2026 with `PeatedBot/1.0 (+https://peated.com/bot)`.
The publishers' robots files allowed these article paths at capture time.
See the [source audit](../../../docs/research/external-review-source-audit-2026-08.md)
and [score comparison](../../../docs/research/review-score-conversion-pilot-2026-09.md).

These are reduced captures, not invented page layouts. They retain the original
containers, classes, headings, dates, authors, bottle names, and score nodes.
Unneeded sections, scripts, images, forms, and comments were removed. Review
prose was replaced with `[Text omitted.]`; these fixtures test score extraction,
not tasting notes or generated clips. No full articles are checked in.
Keep the Dramface bottle paragraph's original line breaks: its first line names
the bottle and later lines describe prices. The formatter skips that paragraph.

| Fixture                                                               | Public source                                                                                                            | Expected result                                                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| [Words of Whisky](wordsofwhisky/ardbeg-ten-cask-strength-2026.html)   | [Ardbeg Ten Cask Strength](https://wordsofwhisky.com/ardbeg-ten-cask-strength-review/)                                   | Keep 8.7/10; count 87 under the reviewed site setting.                                     |
| [Dramface](dramface/caol-ila-25-2024.html)                            | [Caol Ila 25](https://www.dramface.com/all-reviews/2024/caol-ila-25)                                                     | Keep the published 3/10, not the parenthetical 8/10; exclude it under this site's setting. |
| [WhiskyNotes](whiskynotes/ardnahoe-inaugural-infinite-loch-2025.html) | [Ardnahoe Inaugural / Infinite Loch](https://www.whiskynotes.be/2025/ardnahoe/ardnahoe-inaugural-release-infinite-loch/) | Assign the page's 88 to Inaugural and the section's 85 to Infinite Loch.                   |

SHA-256 of the original responses, before reduction:

```text
Words of Whisky: cfd760ae64932e3d0727b1593c7d12f86b49b6e80afd851102b3f9119b16d9d5
Dramface: de9396bf0dca744ca2202c06b28662b1ace37596625fa6ae64e59d1044923e44
WhiskyNotes: 8b11571ebf577813edcc490675974e22aac682b283eaf7c82e81e33b3d0c8155
```

`src/scraper/sinks/externalReviews.test.ts` runs these through the real parser,
review sink, saved site settings, and Bottle totals. It also runs the Words of
Whisky capture through saved scraper rules. Tests create local Bottle references,
check original and counted scores, and repeat ingestion to catch double counting.
They block `fetch`, disable AI clips, and use the test runner's in-memory worker
dispatch. The usual local PostgreSQL and Redis test services are still needed;
websites and AI services are not.

```sh
pnpm --filter @peated/server test -- src/scraper/sinks/externalReviews.test.ts
```

To refresh, fetch the linked public page after checking current access rules.
Record the date and response hash. Reduce it as described above without changing
score text or moving nodes to match the parser. Read the original page to check
each expected score and its bottle before changing a test expectation.
