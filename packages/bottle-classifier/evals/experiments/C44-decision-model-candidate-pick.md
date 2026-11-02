# C44: a decision model picks the candidate

**Rejected, 2026-11-02.** Jev's pick looked like a useful veto on auction
matches (it disagreed with 5 of 11 wrong ones and 4 of 51 right ones), but on
store listings it held about 8 right matches for every wrong one it stopped.
It is not safe as an anchor either: its confident picks share Luna's blind
spot, a Bottle broader than the source.

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

## Results: store-listing matches

241 store-listing match decisions that a moderator later settled, from
moderation History since 2026-09-22 (144 by GPT-6 Luna, 97 by GPT 5.6 Luna):
228 where the moderator kept Luna's Bottle and 13 where the moderator chose
another. Too few critic-review decisions were moderated in that period to
test.

| Veto when                                         | Wrong stopped | Right held |
| ------------------------------------------------- | ------------: | ---------: |
| Jev picks anything else                           |       8 of 13 |  85 of 228 |
| Jev gives Luna's Bottle under 0.10                |       4 of 13 |  31 of 228 |
| Jev gives Luna's Bottle under 0.05                |       2 of 13 |  17 of 228 |
| Jev picks another Bottle or none, at 0.80 or more |       0 of 13 |  10 of 228 |

Store titles are often generic ("Glenlivet 15-year-old Single Malt Whisky"),
and Luna resolves them with product knowledge and search; Jev says
`cannot_tell`. On auction lots the same rule at "under 0.10" stopped 4 of 11
wrong matches and held none of 51 right ones, because auction titles name the
release.

In 11 of the 13 wrong listing matches, the moderator's Bottle was not among
the candidates Luna was given, so the error came from candidate retrieval,
not from Luna's choice. For example, the relaunched Laphroaig 15-year-old
(Bottle 54410) was missing, and Luna picked the original release.

## Decision

Reject the veto as a classifier-wide check: it works only where the source
names its release, as auction titles do. Candidate retrieval is the larger
source of wrong store-listing matches and is worth its own investigation.
