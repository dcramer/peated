# C43: a decision model for edition equivalence

**Promising, 2026-11-02.** On 151 pairs Jev made no wrong answer at a
confidence of 0.5 or more and answered 146 of them; the current rule answered
107 and was wrong on 3. The hard pairs were written for this test, so confirm
on real blocked matches before building anything.

## Problem

`compareBottleFields` in `src/fieldConflicts.ts` compares two editions only by
their markers, the words that contain a digit. It calls `Batch 3` and
`Batch 4` a conflict and `2017 Release` and `2017 Edition` an agreement, but:

- formatting changes the marker, so `11th Edition` and `Edition 11`, or
  `SN2015` and `Supernova 2015`, read as a conflict;
- editions without digits get no answer, so `Committee Release` and
  `Ardbeg Day`, or `1st Release` and `First Release`, are left to the agent.

Whether two short edition texts name the same release is a judgment about the
text alone, which [C41](./C41-decision-model-scope-check.md) and
[C42](./C42-narrow-scope-questions.md) suggest a decision model can make well.

## Method

One `experimental_decide` call per pair. The input is the two edition texts
only; no product name, so the model compares the editions, as the rule does.
One pick-one question: the same edition, a different edition, or cannot tell.
The current rule runs on the same pairs.

## Cases

- **Production pairs (101):** from matched auction lots in the C41 sample.
  The lot's extracted edition paired with its matched Bottle's edition is the
  same edition (55). The same extracted edition paired with another Bottle of
  the same product line, with a different edition, is a different edition
  (46).
- **Hard pairs (about 50):** written for this test from edition wording seen
  in the catalog and in this week's auction lots: ordinals and numbers, number
  words, abbreviations, accents, retailer selections, and wording-only
  editions. Each pair's answer is plain from the text. In the run there were
  50: 25 same and 25 different.

## Decision rule

A decision-model answer could stand in for the rule's "no answer" and correct
its formatting conflicts only if it makes no confident wrong answer on either
set. Report accuracy, confident wrong answers, and the rule's wrong and empty
answers.

## Results

One run on 2026-11-02: 151 calls, no failures, total estimated cost $0.0025.

| Set              | Rule right | Rule wrong | Rule no answer | Jev right | Jev wrong | Jev cannot tell |
| ---------------- | ---------: | ---------: | -------------: | --------: | --------: | --------------: |
| Production (101) |         89 |          0 |             12 |       101 |         0 |               0 |
| Hard (50)        |         18 |          3 |             29 |        46 |         1 |               3 |

| Jev confidence at least | Answered | Wrong |
| ----------------------- | -------: | ----: |
| 0.5                     |  146/151 |     0 |
| 0.7                     |  144/151 |     0 |
| 0.9                     |  122/151 |     0 |

- The rule's three wrong answers are formatting read as conflicts:
  `11th Edition` vs `Edition 11`, `Edition No4` vs `Edition No. 4`, and
  `SN2015` vs `Supernova 2015`. Jev called all three the same at 0.91–0.99.
- The rule gave no answer for every wording-only pair, including identical
  text such as `Committee Release` vs `Committee Release` (8 of its 12
  production gaps). Jev answered all of them correctly, including
  `Committee Release` vs `Ardbeg Day · Fèis Ìle 2019` as different (0.77).
- Jev's one wrong answer was low-confidence: it called
  `for Nauticus and Royal Mile Whiskies` and
  `Royal Mile Whiskies & Nauticus Exclusive` different at 0.45.
- It could not tell three pairs: `Committee Release` vs `Committee Edition`,
  `for The Whisky Exchange` vs `The Whisky Exchange Exclusive`, and
  `Distillery Exclusive` vs `Distillery Only`.
- `Cask #2787` vs `Cask 2787 · Fèis Ìle 2023` was right but only at 0.50.

## Next step

Measure it on real cases before any change. The edition comparison is shared
by every source, so sample saved checks from store listings, critic reviews,
photos, and auction lots: matches blocked by an edition conflict, and matches
the rule let through where both editions are wording only. A separate, deterministic
finding: identical edition text should count as an agreement in the rule.
