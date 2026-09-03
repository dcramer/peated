# Review score comparison checks

Checked September 3, 2026. Expanded the September 2 pilot to eight whiskies
across four publishers. This records public evidence and recommended settings;
it does not change production settings or verify stored Bottle IDs.

## Decision

- **Words of Whisky:** use `score × 10` for scores out of ten. Its
  [guide](https://wordsofwhisky.com/thijs-klaverstijn-whisky-enthusiast-journalist/)
  explicitly describes these as 100-point scores written with one decimal.
  This restores the publisher's scale; it does not make reviewers agree or make
  every description identical to Peated's bands.
- **Dramface:** display original scores, but leave them out of the combined
  quality score. Its scores can change substantially with price, even for the
  same whisky. Reject multiplication by ten and the previous trial table.
- **Breaking Bourbon:** display original scores where publication is allowed,
  but leave them out of the combined quality score. Its overall rating includes
  value and uniqueness. Multiplication by twenty is unsupported.
- **WhiskyNotes:** retain its published 100-point scores. The comparison below
  shows ordinary disagreement with Words of Whisky, not a difference Peated
  should erase.

## Reviews of the same releases

These three pairs agree on the named release, year, strength, and stated casks.
Scores link to the publisher's review. The final column applies only the score
comparison supported by Words of Whisky.

| Release                                                                   | Words of Whisky                                                                       | Dramface                                                                                       | Peated score from Words of Whisky |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------- |
| Ardbeg Ten Cask Strength, 2026 Committee release, 61.7%                   | [8.7/10](https://wordsofwhisky.com/ardbeg-ten-cask-strength-review/)                  | [8/10](https://www.dramface.com/all-reviews/2026/ardbeg-10-cask-strength)                      | 87                                |
| Ardnahoe Inaugural, 2024, 5 years, 50%                                    | [8.7/10](https://wordsofwhisky.com/ardnahoe-inaugural-release-first-bottling-review/) | [8/10](https://www.dramface.com/all-reviews/2024/ardnahoe-inaugural-5yo-2024)                  | 87                                |
| Ardnamurchan AD/10, 2024 anniversary, 50%, bourbon and Paul Launois casks | [8.6/10](https://wordsofwhisky.com/ardnamurchan-ad-10-review/)                        | [8/10](https://www.dramface.com/all-reviews/2024/ardnamurchan-ad10-sauternes-adventures-03-16) | 86                                |

The Ardnamurchan article reviews several releases. AD/10 is review 3 and the
bonus Ainsley review; both give 8/10. Dougie also notes a personal scoring
adjustment. The article's first rating is for a different whisky. The Ardbeg
article consistently gives 8/10 despite inconsistent accompanying labels.

Three more comparisons cover regular releases. Their batch limits matter:

| Whisky                                             | Words of Whisky                                                             | Dramface                                                                                       | Match limit                                                                                                                             |
| -------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Springbank 5 Years 100 Proof, 2025, 57.1%, bourbon | [8.5/10 → 85](https://wordsofwhisky.com/springbank-5-years-100-proof-2025/) | [7/10](https://www.dramface.com/all-reviews/2025/springbank-5yo-100-proof)                     | Both discuss the new 2025 release; no shared bottle code verified.                                                                      |
| Ardnahoe Infinite Loch, 50%                        | [8.7/10 → 87](https://wordsofwhisky.com/ardnahoe-infinite-loch-review/)     | [7/10](https://www.dramface.com/all-reviews/2025/ardnahoe-infinite-loch-society-bottling-2024) | Both cover the early core release; no shared bottle code verified. Dramface's second review is the Society bottling, not Infinite Loch. |
| Balblair 15 Years, 46%                             | [8.5/10 → 85](https://wordsofwhisky.com/balblair-15-years-review/)          | [5/10](https://www.dramface.com/all-reviews/2024/balblair-15yo-re-review)                      | Different batches: Words of Whisky says 2023; Dramface gives a 2021 bottle code. Excluded from exact-release comparisons.               |

[WhiskyNotes gives Infinite Loch 85/100](https://www.whiskynotes.be/2025/ardnahoe/ardnahoe-inaugural-release-infinite-loch/),
compared with Words of Whisky's restored 87. Its article also reviews the
Inaugural release; use the explicit 85 beside Infinite Loch, not the page's 88.

## Why the other scales stay separate

**Dramface's Caol Ila 25 is the decisive example.** The
[review](https://www.dramface.com/all-reviews/2024/caol-ila-25) describes the same
43% whisky as 8/10 at £150, about 6/10 at £224, and gives it 3/10 at £450.
These are the reviewer's price scenarios, not current price checks. The whisky
has not changed between those scenarios. A table cannot recover a quality-only
score from the final number. Do not replace the published 3 with the hypothetical
8 when importing it.

This is consistent with [Dramface's guide](https://www.dramface.com/scoring-system),
which includes value in its descriptions. The Ardnahoe Inaugural review also
explicitly raises 7 to 8 after considering the release's broader context.

**Breaking Bourbon's Buffalo Trace is a five-point example.** Its
[July 2024 review](https://www.breakingbourbon.com/review/buffalo-trace-bourbon)
of the regular 90-proof release publishes `ratingValue: 3`, `bestRating: 5`,
and `worstRating: 1` in its review metadata. The prose recommends the bourbon
at its stated $30 price. Multiplying 3/5 into 60/100 would place that positive
review in Peated's lowest score range. The publisher's
[guide](https://www.breakingbourbon.com/site/ratings-review-philosophy) says its
overall rating combines tasting, uniqueness, and value. No quality-only
100-point equivalent is established by that guide or review.

The previous Dramface trial was `6 → 82, 7 → 87, 8 → 92, 9 → 97, 10 → 100`.
Those were editorial guesses. Adding lower points would fix its omission of
low ratings, but would not remove price from the scores. More matching reviews
cannot resolve that difference in what the sites measure.

## Effect on the combined score

For each of the three exact-release pairs above, counting only whole-number
100-point reviews gives no score from this sample. Adding Words of Whisky
gives one counted score: **87, 87, and 86**, respectively. Original Dramface
scores remain visible but do not count.

Multiplying both sites by ten would instead give each pair a lower-middle
median of **80**. The old trial table would give **87, 87, and 86**—the same
headline result as the recommended setup, despite counting unsupported
scores. Check which reviews count, not just whether the headline looks
reasonable. This calculation uses one Dramface review per pair.

For an arithmetic example with an existing 100-point review, Infinite Loch's
85 from WhiskyNotes plus 87 from Words of Whisky gives two scores and a
lower-middle median of 85. Their shared stored Bottle assignment would still
need to be verified before applying that example to production. None of these
sample totals describes a complete production Bottle.

## Settings ready for preview

For Words of Whisky, enable inclusion and add these rules with the guide linked
above. Leave dates unset: the recorded scale distinguishes the formats; no
calendar cutoff was established by this check.

| Recorded scale | Site score → Peated score | Reason to save                                                                                             |
| -------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 10             | `0 → 0`, `10 → 100`       | The publisher describes its decimal scores as 100-point scores divided by ten. Restore the original scale. |
| 100            | `0 → 0`, `100 → 100`      | Preserve already recorded original 100-point scores without multiplying them again.                        |

For Dramface and Breaking Bourbon, leave inclusion off. This is a decision
based on their stated scoring purpose, not missing arithmetic.
The original score and source link still help readers understand each review.
Collection and publication remain subject to the separate
[source checks](external-review-source-audit-2026-08.md).

The implemented site settings, original-score display, and before/after preview
support these decisions. No additional score-matching feature is needed for this
first rollout. Use the [setup guide](../operations/external-review-sources.md)
to verify stored reviews and apply the settings after deployment.
