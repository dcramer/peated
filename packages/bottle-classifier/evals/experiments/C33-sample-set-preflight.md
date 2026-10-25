# C33: Ignore sample and miniature sets before extraction

**Decision: Reverted on 2026-10-25.** The pattern decided what a listing is
from its wording, which `docs/policies/agent-design.md` forbids: regexes and
keyword lists must not be the final decision for meaning. The change merged
in PR #1485 and was removed in a follow-up PR. The Glenlivet case again
expects `no_match` and stays as a model-judgment miss.

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
identity model. This record first treated the deterministic multi-item check
as the owner, following the existing pattern list; that was the mistake. The
judgment that a listing is a set, not one Bottle, belongs to the model or to
structured lot facts from the auction source.

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

## Why it was reverted

Matching `sample` or `miniature` followed by `set`, `pack`, or `kit` turns a
semantic judgment into a phrase rule and skips the model for any title that
happens to use those words. The open owners are a general scope rule in the
classifier prompt, taught with other values and measured by A/B, or lot
contents captured as structured facts by the auction adapter.
