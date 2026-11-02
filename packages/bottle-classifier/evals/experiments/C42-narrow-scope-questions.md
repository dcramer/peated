# C42: narrow scope questions for a decision model

**Rejected, 2026-11-02.** Narrow yes-or-no questions separated in-scope from
out-of-scope lots worse than C41's single pick-one question, and the
cask-finish question did not fix the case it was written for.

## Problem

[C41](./C41-decision-model-scope-check.md) asked Jev one broad pick-one
question ("what does this lot sell?") and one broad yes-or-no question. The
pick-one answer was right for about 99% of lots, but it was confidently wrong
on the hard cases, and the broad yes-or-no answer was not usable.

## Hypothesis

Several narrow yes-or-no questions in the same call, each about one thing the
title can show, separate in-scope from out-of-scope lots better than one broad
question. A separate cask-finish question can stop a whisky named for its
finish (Longrow Red Tawny Port) from reading as another drink.

## Method

Same model, input, and lots as C41: one `experimental_decide` call per lot
with the lot title, stored size, and condition. Ten yes-or-no questions share
the call: several items sold together, a drink other than whisky, a whisky
finished in another drink's cask, flavored whisky or liqueur, a sample, a
distillery hand-fill, new-make spirit, a miniature, not a drink at all, and a
damaged or opened bottle (no labels; reported only).

A lot is scored out of scope by the highest probability among the scope
questions. The "drink other than whisky" answer counts only when the
cask-finish answer is below one half.

## Labels

C41's labels, updated for the owner decision of 2026-11-02: a bottle sold
with a book, print, or coaster is in scope, so those lots count as in scope
whatever their current status. A book or print sold alone is out of scope.
Oban 14 Year Old 20cl and Macallan Coronation 35cl stay excluded.

## Decision rule

The same as C41: the threshold must make no wrong ignore. Compare how many
out-of-scope lots each version catches at that threshold, and read every
disagreement with the labels.

## Results

One run on 2026-11-02 over the same 3,345 lots: no failed calls, median
193 ms per call, total estimated cost $0.09. Scored: 1,407 in-scope and 273
out-of-scope lots.

| P(out) at least | C41 wrong ignores | C41 caught | C42 wrong ignores | C42 caught |
| --------------- | ----------------: | ---------: | ----------------: | ---------: |
| 0.70            |                 9 |    252/273 |                 9 |    241/273 |
| 0.80            |                 5 |    235/273 |                 4 |    212/273 |
| 0.90            |                 3 |    228/273 |                 4 |    161/273 |
| 0.95            |                 2 |    199/273 |                 4 |    139/273 |
| 0.99            |                 1 |    149/273 |                 0 |      1/273 |

- Yes-or-no answers sit in a narrow range: about 0.1 for a plain in-scope
  lot on every question and at most 0.98 for any lot, so no threshold catches
  much without a wrong ignore.
- The cask-finish question gave Longrow 11 Year Old Red Tawny Port 0.16–0.21,
  and "a drink other than whisky" 0.98. Longrow 15 Year Old Red Pinot Noir
  got 0.34–0.45 and 0.97. The model reads the drink's name as the product.
- New false alarms as samples: Kilkerran 2004 Work In Progress #1 (0.72),
  Longrow 8 Year Old Open Day 2023 (0.71), Glenlivet 21 Sample Room
  Collection (0.73).
- Some misses moved but stayed below a safe threshold: Valinch 0.56 to 0.67,
  Bedford Park rum 0.77 to 0.90, Kill Devil rum 0.29 to 0.49. Ardnamurchan new
  make stayed at 0.15.

## Decision

Reject. Asking narrower questions did not add the product knowledge these
cases need. Scope stays with the agent, which can search. If a decision model
is used for scope later, use one pick-one question, not yes-or-no questions.
