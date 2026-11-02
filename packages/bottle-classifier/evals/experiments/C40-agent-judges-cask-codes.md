# C40: let the agent judge cask-specific matches

**Accepted 2026-11-02**, pending the full-suite run in pull request CI. Without the
check, the agent created the right Bottle for both C09 targets in every run, and
no run made a wrong existing match.

## Problem

[C09](./C09-unverified-cask-code-match.md) added a post-model check: when the
matched Bottle stores a cask code that the source does not repeat, code turns
the Match into No Match. It was added because Luna high matched Elijah Craig
18-year-old Single Barrel and Masterson's French Oak Finish to Bottles for
one barrel in every saved run.

In production on 2026-11-02, the check turned correct auction matches into No
Match. One was a vatting with a stored cask list (Kilchoman Club 11th Edition).
Another source printed the cask without its fill year (`429` against a stored
`429/2007`). A third named the cask by its marketed name and printed no code
(Bimber Pablo). The check relies on stored data, and stored flags and cask
fields are sometimes wrong. Code cannot tell these shapes apart from C09's
without reading whisky meaning, which is the agent's job
(`docs/architecture/bottle-classifier.md`, "Deterministic Code").

## Hypothesis

GPT-6 Luna high on the AI SDK runtime no longer needs the check. Without it,
the agent still declines or creates for a generic source against a
barrel-specific candidate, and it records a risk when the cask is unsettled.

## Change

Variant B removes the cask-code downgrade from `rejectInvalidExistingMatch` in
`src/reviewPolicy.ts`. The unknown-target check and the field comparison stay.
Variant A is `origin/main` at `3e0e65f6a`.

## Cases and decision rule

Twenty cases: every decision case with a candidate that stores a cask number
or is flagged single cask, plus Masterson's. They include C09's two targets,
the exact-cask matches that must keep matching (Ardbeg 2787 and 3771, SMWS),
and the creates and ignores with cask-coded candidates nearby.

Accept only if B makes no wrong existing match that A does not, creates no
duplicate where a case expects a match, and moves no review case to
automatic. Any wrong match on the Elijah Craig or Masterson's candidates
rejects the change.

## Settings and order

Controlled lane: `evals/evidence/ci.json`, no Firecrawl key, GPT-6 Luna high,
a fresh copy of the committed recordings per run. Three runs per variant in
the order A, B, B, A, A, B, one checkout, sequential.

## Results

Runs on 2026-11-02, about 9–11 minutes each. The change adds no model work;
estimated model cost per run was $0.029–$0.040 in both variants.

| Case                                     |  A (main) | B (no check) |
| ---------------------------------------- | --------: | -----------: |
| Elijah Craig 18 Single Barrel (create)   |       3/3 |          3/3 |
| Masterson's French Oak Finish (create)   |       2/3 |          3/3 |
| Ardbeg 2006 cask 2787 (exact-cask match) |       3/3 |          2/3 |
| Glen Breton 21 cask 665 (create)         |       2/3 |          3/3 |
| TBWC Paul John Batch 2 (match)           |       0/3 |          0/3 |
| Other 15 cases                           |     45/45 |        45/45 |
| **Total**                                | **55/60** |    **56/60** |

- Wrong existing matches: none in either variant. In B, both C09 targets
  created the generic Bottle instead of matching barrel 4040 or F2-038.
- The B Ardbeg miss was the agent's own decline: it read the candidate's
  stored edition, which repeats the cask number, as a conflict. The check
  plays no part in a decline.
- The A misses were the agent's own judgment too: one Masterson's create
  with a field difference and one Glen Breton decline.
- Paul John fails every run on main for an unrelated reason.
- No review case moved to automatic.

## Decision

Remove the check. In these runs it never stopped a wrong match, because the
agent no longer makes C09's mistake, and in production it turned correct
matches into No Match. A different cask number in the source still adds a
conflict risk through the shared field comparison. Confirm with one full-suite
run before merging.
