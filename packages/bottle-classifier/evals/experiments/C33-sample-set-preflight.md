# C33: Ignore sample and miniature sets before extraction

**Decision: Accepted.**

## Problem

Production auction lot 6333, `GLENLIVET G&M GENERATIONS 70 YEAR OLD SAMPLE
PRESENTATION SET`, was matched to the full 70-year-old Bottle 65654. The lot
is a tiny vial packed with a book and a USB stick. The classifier's identity
judgment was consistent with the Whisky Identity Model, which treats a sample
of the same whisky as the same Bottle. What made the match wrong is scope: a
set is not one Bottle listing, and auctions leave sets and miniatures out
(`docs/features/auctions.md`). The single-miniature lot check does not catch
it, because the lot stores no volume.

A prompt rule that a sample is not the full Bottle would contradict the
identity model, so the owning layer is the deterministic multi-item check.

## Change

- Add `sample` or `miniature`, optionally `presentation`, followed by `set`,
  `pack`, or `kit` to the multi-item patterns in `src/reviewPolicy.ts`.
- A bare `sample`, a cask-sample name, and `in Presentation Box` stay with the
  classifier.
- The Glenlivet eval case now expects `ignored`.

Unit tests cover three positive titles with different values (Mortlach
Generations sample presentation set, Lagavulin miniature set, Ardbeg samples
kit) and three negatives (Glenfarclas in a presentation box, a single
Springbank sample, Bruichladdich Cask Sample 2010).

## Results

Controlled runs used `evals/evidence/ci.json` with no Firecrawl key.

| Case                 | Before                         | After |
| -------------------- | ------------------------------ | ----: |
| Glenlivet sample set | 0/4 (one CI run, three reruns) |   3/3 |

The case now makes no model call.
