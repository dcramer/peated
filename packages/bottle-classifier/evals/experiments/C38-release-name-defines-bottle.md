# C38: a release name defines a distinct Bottle

**Decision: Accepted (dcramer, 2026-10-26).** B scored 307 of
351 against 304, fixed Highland Park No. 5 (0/3 to 3/3), moved both High
West targets off zero, and removed the three wrong existing matches main made
on those cases. It met every rejection test. The cost is a lost match on
Elijah Craig Cask Strength (3/3 to 1/3), which now declines over a name
difference that is not a release name.

## Problem

The open "broader-candidate refusal" list named five families. On main
`a4253de3e` (CI run 40340924919 and three local runs), they split by owning
layer:

| Case                              | Current result                         | Owning layer                                    |
| --------------------------------- | -------------------------------------- | ----------------------------------------------- |
| High West Act 10 Scene 4 (create) | `no_match` 0/3                         | Model judgment: candidate scope                 |
| High West Act 12 Scene 9 (create) | `no_match` 2/3, `create` with edition  | Model judgment: candidate scope                 |
| Highland Park Cask Strength No. 5 | `no_match` 2/3, `match` to the generic | Model judgment: candidate scope                 |
| Elijah Craig (both creates)       | passes in CI and C36                   | Run variance, not this cluster                  |
| Willett barrel 4769               | `caskStrength: null`                   | Open M11 decision: cask strength from ABV alone |

In each of the three real misses, the only local candidates lack the source's
release name: the act without the scene, or the Cask Strength line without
the release number. The model rejects them as targets, then will not create
the Bottle, because it "cannot establish" that the release name defines a
distinct Bottle ("the unresolved significance of Scene 9"). In one run it
matched the broader Act 12 Bottle, calling the scene "missing enrichment".

Decision step 4 says an extra source trait makes a candidate too broad "only
when evidence shows that trait defines a distinct marketed Bottle". The model
reads this as needing outside evidence. The naming rule (identity rule 3)
already says a release name people use as the title belongs in `name`, but no
decision step connects the two.

The fixed inputs also carry the shape from before C36: the release words sit
in `edition`, while the current extractor puts them in `expression` in 9 of 9
runs. Moving them changed nothing (0/9 before and after), so the inputs are
not the cause. Both variants below use the current-extractor inputs so the
A/B reflects what production sends.

## Change

One sentence in decision step 4, with no examples: a release name that the
naming rule keeps in `name` identifies a distinct marketed Bottle on its own,
so a candidate without it is too broad, even when web evidence does not
discuss it.

## Expected effect

The three targets create the Bottle instead of declining. Matches where the
candidate already carries the release name, batch editions, and name-only
sources with over-specific candidates (Springbank 25) do not change.

Rejected if any wrong existing match appears, a duplicate is created where a
case expects a match, or a review case moves to automatic.

## Cases

117 classifier cases: every match, ignore, correction, and new-Bottle
decision case, and every real-world new-Bottle case.

## Settings and order

Controlled lane: `evals/evidence/ci.json`, no Firecrawl key, GPT-6 Luna high,
a fresh copy of the committed recordings per run. Variant A is `origin/main`
at `a4253de3e` with the current-extractor inputs for the three targets;
variant B is A plus the step 4 sentence. Three rounds; in each round A and B
run at the same time from separate checkouts.

## Results

Three rounds per variant over 117 cases. Cases not
listed passed every run in both variants, or failed every run in both for the
same reason (Clynelish 14, Paul John, Quinta Ruban, Hedonism², Mars
Komagatake, Willett, Basil Hayden tier).

| Case                                 |    A (main) |  B (change) |
| ------------------------------------ | ----------: | ----------: |
| Highland Park Cask Strength No. 5    |         0/3 |     **3/3** |
| High West Act 12 Scene 9             |         0/3 |     **2/3** |
| High West Act 10 Scene 4             |         0/3 |     **1/3** |
| Elijah Craig Barrel Proof C923       |         1/3 |         2/3 |
| Shieldaig Speyside 30 (two cases)    |         4/6 |         5/6 |
| Macallan Classic Cut 2021            |         1/3 |         3/3 |
| Octomore 13.1                        |         2/3 |         3/3 |
| **Elijah Craig Cask Strength match** |     **3/3** |     **1/3** |
| Trestle Spirit of Eclipse (image)    |         2/3 |         0/3 |
| Watchpost                            |         2/3 |         0/3 |
| Glenlivet Caribbean Reserve          |         3/3 |         2/3 |
| Heaven's Door Volume III             |         3/3 |         2/3 |
| Creag Isle 12                        |         3/3 |         2/3 |
| **Total**                            | **304/351** | **307/351** |

- Wrong existing matches: A made three, all on the targets. Two Act 12 runs
  matched the broader Act 12 Bottle 43397, and one Act 10 run matched the
  Act 10 candidate, each calling the scene "missing enrichment". B made none.
- Duplicate creates where a match is expected: Paul John in all six runs and
  Clynelish 14 in one run of each variant, the same as main before this change.
- No review case moved to automatic.
- The remaining target misses: one Act 10 run and one Act 12 run declined;
  one Act 10 run and one Act 12 run created the Bottle but split the scene
  into `edition` ("A Midwinter Night's Dram" with edition "Act 10 Scene 4").
  That is a naming-shape miss, not a scope miss.
- The cost: B declined Elijah Craig Cask Strength against the stored Barrel
  Proof Bottle in two runs, saying the different name might be a different
  release. That is the sentence read too broadly, on name wording that is not
  a release name. One Glenlivet Caribbean Reserve run declined for "extra name
  wording" the same way. Both are declines, so they go to review rather than
  making a wrong record.
- Trestle's B misses are the open whisky-category question from C37; one also
  cited the stored bottler again. Watchpost's misses name the Bottle "American
  Blended Whiskey", the producer's style words, instead of "Whiskey"; A did the
  same once.
- Cost and time were about equal: $0.56 vs $0.58 in model estimates
  (10.3M vs 10.9M input tokens, about 90% cached), median 24.4s vs 22.9s per
  case, p95 59.7s vs 61.2s. No run errors.
