# C41: a decision model for auction scope

**Rejected for automatic ignores, 2026-11-02.** Jev answered the scope
question correctly for about 99% of lots, but its wrong answers were confident
and fell on the hard cases, so no threshold ignores lots safely beyond the
easy ones that existing rules already catch.

## Problem

Deciding whether a source sells one whisky bottle is one judgment about a
short text. Today it is split between phrase rules in `src/reviewPolicy.ts`
(non-whisky words, gift sets, bundles, condition), the auction miniature rule
(stored size of 100 ml or less), and a full agent run that may return `ignore`.
Moderators still ignored hundreds of out-of-scope auction lots by hand in
October 2026 (trade samples, hand-fills, sets with glasses, accessories).
Phrase rules miss these, and one was reverted for deciding scope from words
([C33](./C33-sample-set-preflight.md)).

## Hypothesis

A decision model (`DECISION_MODEL`, TypeSafe AI's Jev) can answer the scope
question from the lot title, size, and condition alone, with probabilities
that separate in-scope lots from out-of-scope ones. Above a high threshold it
could ignore a lot before any agent run, and it could replace the phrase
rules.

## Method

One `experimental_decide` call per lot. The input is a JSON object with the
lot title, stored size in ml, and condition. No candidate or proposed Bottle
is passed: scope depends only on what the lot sells. Two questions share the
call:

- `scope` (pick one): one whisky bottle, another spirit or drink, flavored
  whisky or liqueur, several items sold together, miniature, sample, distillery
  hand-fill, or not a drink. The options restate the documented scope rule in
  `docs/features/auctions.md` and the classifier instructions.
- `oneWhiskyBottle` (yes or no): whether the lot sells exactly one whisky
  bottle.

## Cases

Every fourth Scotch Whisky Auctions lot from the October 1 and 184th auctions
(3,347 lots), read on 2026-11-02:

- **Out of scope:** lots now `ignored` (273), whether by the miniature rule,
  phrase rules, the agent, or a moderator.
- **In scope:** lots now `matched` (1,404).
- **Excluded from scoring:** lots whose label is disputed. These are Oban 14
  Year Old 20cl and Macallan Coronation 35cl, which are ignored although above
  the miniature size, and bottles sold with a book, booklet, or print, where
  the October 26 title review and the classifier instructions disagree.
- **Unlabeled:** lots still in `review` are scored for discovery only. Their
  top out-of-scope answers are checked by hand.

## Decision rule

Pick the threshold on P(not one whisky bottle) that makes no wrong ignore
among in-scope lots. Report how many out-of-scope lots it catches at that
threshold, split by how they were ignored today (before the agent, by the
agent, or by a moderator). Worth building only if it catches most lots that
needed the agent or a moderator, with zero wrong ignores. Confirm any
threshold on a later held-out auction before use.

## Results

One run on 2026-11-02 over 3,345 lots: no failed calls, median 175 ms per
call, total estimated cost $0.10 (about $0.00003 per lot, roughly 100 times
less than an agent run). Scored: 1,401 in-scope and 264 out-of-scope lots.

- **Pick-one answer:** right for 1,390 of 1,401 in-scope lots and 258 of 264
  out-of-scope lots.
- **Yes-or-no answer:** not usable. In-scope lots had a median probability of
  0.54 and out-of-scope lots 0.15, with wide overlap; the pick-one answer
  gave 1.00 and 0.01.

| P(not one whisky bottle) at least | Wrong ignores | Out-of-scope caught | Caught that needed the agent or a moderator |
| --------------------------------- | ------------: | ------------------: | ------------------------------------------: |
| 0.50                              |            14 |             258/264 |                                     118/120 |
| 0.90                              |             2 |             224/264 |                                      94/120 |
| 0.99                              |             1 |             147/264 |                                      58/120 |
| 1.00                              |             0 |              65/264 |                                      15/120 |

Some of the 14 wrong ignores at 0.50 are label noise (a bottle sold "With
Poster & Bag"). The rest are the hard cases:

- whisky finished in a wine or port cask and named for it (Longrow Red Tawny
  Port at 0.99, Longrow Red Pinot Noir);
- product names with a scope word (Glenlivet 21 Sample Room Collection, Arran
  Malt & Music Festival, Fettercairn Warehouse 2);
- a ceramic decanter of whisky (Beneagles Merlin 20cl) and a vatting of two
  vintages (Karuizawa 1999 & 2000).

It missed out-of-scope lots that need knowledge rather than reading: rum sold
under a bottler name (Bedford Park, Kill Devil, Foursquare), Ardnamurchan new
make, and two Valinch hand-fills, although the options named Valinch.

Of 1,668 lots still in review, 15 scored at least 0.90. Thirteen were
plainly out of scope (Marsala, Madeira, tequila, rum, Moutai, new make, a
plinth, a print, a glasses set, a stopper); two were whisky (Togouchi Saint
Seiya, Bushmills Port Cask Steamship #2). Most of the thirteen were checked on
October 1, before the agent could return `ignore`.

## Decision

Do not ignore lots automatically from a decision-model answer. The cases it
gets right are mostly the ones the size rule and phrase rules already catch;
the edge cases need product knowledge or research, which is the agent's job.
Possible uses that keep a person in the loop: a "likely not one whisky
bottle" suggestion in the Inbox, or a one-time sweep of the review queue
with each flag checked by hand.

Rule question found while labeling, settled by the owner on 2026-11-02: a
bottle sold with a book, print, or coaster is in scope, as the October 26
title review kept it. A bottle sold with glasses or a mini is a set. The
classifier instructions still say a Bottle sold "with glassware or other
items" is out, and the agent and moderators have ignored some book and print
lots since, so the instructions need a tested change.
