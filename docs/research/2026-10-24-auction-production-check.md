# Auction production check — 2026-10-24

A read-only check of Scotch Whisky Auctions (`scotchwhiskyauctions`) in
production after [dcramer/peated#1377](https://github.com/dcramer/peated/pull/1377)
deployed. It covers collection state, match counts, a spot check of matches and
prices, why lots wait in review, and classifier coverage from real lots. Nothing
in production was changed. Rules live in the
[auction model](../features/auctions.md) and the
[rollout guide](../operations/auctions.md); this note does not override them.

## Collection state

Read with `pnpm cli api get` on the health, runs, match-queue, and lot routes.

- #1377 is live: lot reads return `sourceDetailsRequestedAt` and the other
  detail-request fields from migration `0321_auction_details`.
- The target is enabled, robots rules are enforced, and the limit is 120
  requests per hour with 30-second spacing. `runEvery` is null.
- The only run is the manual run of October 1, 2026: 458 requests, 8,965 lots,
  no request errors. No detail runs have been requested.
- All lots are from the 182nd and 183rd auctions and all are closed. Closed
  lots cannot send watch alerts, so no alert has been sent.
- The 184th auction ran while collection was off and ended October 11, 2026.
  None of its lots or results are in production. The public auction index
  showed no open or upcoming auction on October 24; auctions have ended
  monthly, on the second Sunday or nearby.

## Match counts

| State                                        | Lots  |
| -------------------------------------------- | ----- |
| Waiting for review                           | 6,194 |
| Matched by an accepted name, no model call   | 1,236 |
| Matched after a classifier match             | 1,333 |
| Matched by a moderator over a no-match check | 3     |
| Ignored                                      | 199   |
| Total                                        | 8,965 |

Every lot in review has a saved check from October 1–2. Those checks ran under
the rules before #1374 and #1377, and none had source facts from a detail
page. Deployment does not recheck them. The 199 ignored lots are
other spirits named in the title (cognac, rum, gin, armagnac, tequila, vodka,
and similar) and whisky sold with glasses or as a gift pack, which the
classifier's keyword rules catch.

Lot reads do not say who matched a lot, so automatic matches cannot be told
apart from moderator matches, and auction lots do not appear in moderation
History. No doc covers how to measure this.

## Spot check of 20 matches

Twelve classifier matches and eight accepted-name matches, picked at random,
were checked against their lot pages and catalog Bottles.

- All 20 stored hammer prices equal the winning bid on the lot page.
- 16 matches are correct.
- Ardbeg Ardcore Committee Release went to Bottle 414, the 46% general release,
  through two legacy accepted names ("Ardbeg Ardcore Committee Release" and
  "Ardbeg Committee Release Ardcore Limited Edition Scotch Whisky"). The 50.1%
  Committee Release is Bottle 53522. Other legacy names may mix up Committee
  and general releases the same way.
- Grand Old Parr 12 Year Old 1L is 43% on the lot page; Bottle 45523 is 40%.
  The title had no strength and the lot had no detail facts, so nothing
  flagged it. A detail read would have.
- Highland Park 30 Year Old Mini 5cl matched the full Bottle. Miniatures are
  now out of scope.
- Hazelburn 2017 8 Year Old Duty Paid Sample (55.6%, bourbon cask) matched
  Hazelburn Sherry Wood 2025 (48.2%). Whether trade samples belong in scope is
  not decided.

## Why lots wait in review

From the saved checks of sampled lots:

- Code adds an edition-conflict risk when edition wording differs, even for
  the same release: "2017 Release" vs "2017 Edition", or "Cask #2787" vs
  "Cask 2787 · Fèis Ìle 2023". This is the most common blocker for correct
  matches.
- Some correct matches have no unresolved risk but `webEvidence: not_used`,
  which gives no evidence anchor for automatic approval (Macallan Edition
  No. 1, William Larue Weller 2017).
- Wrong catalog facts make the classifier refuse the right Bottle: Ardbeg
  Serendipity stored as `blend`, a Springbank 12 Cask Strength Bottle with a
  bottler, Macallan Classic Cut 2017 with `caskStrength: false`.
- Non-whisky lots ("Macallan Glasses Set", "Candle Holders x 3", "Hennessy
  X.O") get `no_match`, not ignored. The classifier contract only ignores
  through keyword rules, so these wait in review with no way out.
- Brand-only titles ("Writer's Tears", "Glenmorangie Lasanta", "Macallan
  Quest") need the detail page or a single-product brand to resolve.

## Classifier checks

The controlled suite (`evals/evidence/ci.json`) on main had 29 of 119 cases
failing. Against the October 21 control run, seven failures were new. Each was
rerun twice on main and twice on the commit before #1377. Six were model
variance or already failed before. The audit case "one image extraction does
not overwrite populated exact fields" failed three times on main and passed
twice before, but #1377 does not change the audit path; the model sometimes
flags the label reading of cask 7445 against stored cask 173445.

The model checks do not run `assessBottleResolution` in
`apps/server/src/lib/bottleMatchingAutomation.ts`. Shared match-rule changes
need server tests; the suite only covers the classifier package.

#1377 added cask numbers to the shared field-conflict check with a plain text
comparison, so `#3771` and `3771` conflicted. That blocked correct automatic
matches and accepted-name reuse for prices and auctions. Fixed in
[dcramer/peated#1469](https://github.com/dcramer/peated/pull/1469).

Seven auction cases from real lots were added, each verified on its lot page
and, for matches, an independent source. Two runs each:

| Case                                                          | Expected                | Result                                                                        |
| ------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------- |
| Macallan Quest                                                | match 805               | 2/2                                                                           |
| Ardbeg 2006 cask 2787                                         | exact-cask match 52158  | 1/2; the failed run refused because the captured edition held the cask number |
| Classic Cut 2017, stored `caskStrength: false`                | no match, Bottle Review | 2/2                                                                           |
| Writer's Tears                                                | no match, review        | 2/2                                                                           |
| Hennessy X.O                                                  | no match                | 2/2                                                                           |
| Macallan Glasses Set                                          | no match                | 2/2                                                                           |
| Glenlivet G&M Generations 70 Year Old Sample Presentation Set | no match                | 0/2; still matches the sample vial to the full Bottle                         |

## Catalog problems found, not changed

- Bottle 3277 (Classic Cut 2017) should have `caskStrength: true`.
- Aberfeldy 16 (686) stores 43%; the producer lists 40%.
- Yamazaki 12 (2276) stores `releaseYear` 1984, its launch year.
- Likely duplicates: 3277 and 14146 (Classic Cut 2017), 17244 and 4632
  (Glenglassaugh 1976 The Chosen Few; 4632's age 44 is also wrong), 45517 and
  16743 (Johnnie Walker The Royal Route), probably 821 and 3642 (Tomatin 18).
- The two Ardcore legacy names above point at the wrong Bottle.

## Still unknown

- How live auctions parse and how long a full current-auction run takes: no
  auction was open on this date.
- How much detail reads improve matching: none have run.
- The match rate on current rules: the backlog has not been rechecked.
