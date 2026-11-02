# C44: a decision model picks the candidate

**Mixed, 2026-11-02.** Jev's pick is useful as a veto on Luna's matches,
not as an anchor. It disagreed with 5 of 11 wrong Luna matches and with 4 of
51 right ones, but its confident picks share Luna's blind spot: a Bottle
broader than the source.

## Problem

Luna decides which Bottle a source is, and its own evidence labels decide
whether that decision applies automatically. Correct matches wait in review
when Luna labels its evidence `weak` or `not_used`, and some matches to a
broader Bottle are wrong. A second, independent reading of the same source
and candidates could confirm Luna's pick or flag a disagreement.

## Hypothesis

Given only the source's own facts (its title and the identity extracted from
it) and the candidates retrieved before the agent runs, a decision model picks
the right candidate, or says none fits, often enough and with honest enough
confidence to serve as a second opinion. It cannot search, read pages, or fill
fields, so it is not a replacement for Luna.

## Method

One `experimental_decide` call per case. The input is the source title, the
non-empty extracted identity fields, and up to 30 initial candidates with
their name, edition, age, ABV, years, cask number, single-cask and
cask-strength flags, category, Brand, and bottler. One pick-one question has
one option per candidate, plus `none_of_these` (no candidate is this release)
and `cannot_tell` (the source does not say enough).

## Cases

Every classifier decision case in `src/eval-fixtures/decision-cases` with a
verified `match`, `create_bottle`, or `no_match` answer (76): 39 store
listings, 20 photos, 10 critic reviews, and 7 auction lots. A match counts
only when its Bottle is among the initial candidates; 9 match cases whose
Bottle Luna found only by searching are left out. The right answer is the
matched Bottle, `none_of_these` for a create, and `cannot_tell` for a no
match.

## Decision rule

Useful as a second opinion only if confident picks (above a threshold set
from these cases) include no wrong existing Bottle. Report accuracy by
action and source, confident wrong picks, and how often a create is called
`none_of_these`.

## Results: eval cases

One run on 2026-11-02: 76 calls, no failures, median 174 ms, total estimated
cost $0.0026.

| Expected     | Right | Wrong Bottle | Said none | Said cannot tell |
| ------------ | ----: | -----------: | --------: | ---------------: |
| Match (36)   |    29 |            2 |         1 |                4 |
| Create (32)  |    20 |            4 |         — |                8 |
| No match (8) |     3 |            3 |         2 |                — |

By source, right answers were 25 of 39 store listings, 13 of 20 photos, 8 of
10 reviews, and 6 of 7 auction lots. Wrong-Bottle picks came with high
confidence: 3 of the 9 were at 0.90 or more. They are the broad-or-narrow
cases Luna also gets wrong: Elijah Craig 18 Single Barrel picked barrel 4040
(0.90), Masterson's picked barrel F2-038 (0.78), Laphroaig Càirdeas 2022
picked the plain Càirdeas Bottle (0.94), and Macallan 12 Double Cask picked
the ageless Double Cask (0.86). Photo cases often said `cannot_tell`, because
a photo's title is only "Bottle photo upload" and Jev sees no label text.

## Results: Luna's own matches

62 saved auction match decisions from the 184th-auction sample and the
October 1 pilot screen, each judged by hand: 51 right, 11 wrong or doubtful.
Jev saw the same candidates Luna started from.

| Luna's match | Jev picked the same Bottle | Jev picked something else |
| ------------ | -------------------------: | ------------------------: |
| Right (51)   |                         47 |                         4 |
| Wrong (11)   |                          6 |                         5 |

- **As a veto** (send the item to review when Jev picks something else),
  it would stop 5 of 11 wrong matches and hold 4 of 51 right ones. Among the
  pilot's 30 matches, which all passed the current automation rules, it would
  have stopped 4 of the 7 doubtful ones at the cost of 4 of the 23 good ones.
- **As an anchor** (apply when both agree), it is not safe. Of 41 agreements
  where Jev was at least 0.90 sure, 2 were wrong: Tormore 14 Year Old
  Cadenhead's to an ageless Cadenhead's Tormore (0.95), and Boutique-y Blended
  Grain 30 Year Old to the ageless Blended Grain Bottle (0.90).
- One disagreement found a likely duplicate: for Bowmore 26 Year Old Vintner's
  Trilogy French Oak, Jev picked a second Bottle with the same name.

A follow-up pair of questions on the same 62 matches asked whether the source
names a release detail the Bottle lacks, and the reverse. "The Bottle has
more" fired on nearly every match, because records carry strength and cask
facts that titles omit. "The source has more" caught 5 of 11 wrong matches
with 7 false alarms at 0.70, no better than the pick disagreement, and it
missed Tormore's "14 Year Old" (0.12).

## Decision

Keep as a candidate veto, not an anchor. Before building it, measure it on
saved match decisions from store listings and reviews; the Luna comparison
above covers auction lots only. A veto only sends a match to review, so it fits the rule
that model confidence can never raise the automation tier.
