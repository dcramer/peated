# Ratings

Peated has two kinds of member input:

- A tasting records an experience. It can have one broad rating band.
- A member review records a considered opinion about one exact Bottle. It has
  one whole-number score from 0 through 100 and optional notes.

These records have different intent. Do not add review fields to a tasting.

## Tasting bands

The shared band table lives in `apps/server/src/constants.ts`.

| Band        | Range  |
| ----------- | ------ |
| Mediocre    | 0–79   |
| Good        | 80–84  |
| Very good   | 85–89  |
| Outstanding | 90–94  |
| Unicorn     | 95–100 |

A tasting stores the band name, not a point value. Bottle summaries count each
tasting. Repeat tastings by one member count as separate experiences. The UI
shows band names, ranges, and raw counts. It does not turn bands into stars,
percentages, or five-point values.

Historical tastings can still have `legacySimpleRating` or
`legacyStarRating`. These fields are read-only. They do not enter any new
summary. Their Drizzle fields contain the same rule beside the schema.

## Member reviews

`member_review` owns member scores. A member can have at most one review for an
exact Bottle. Saving again updates that review. A Bottle merge keeps the review
with the latest `updatedAt`. A larger review ID breaks an exact time tie.

Review privacy controls attribution only. A private member's review is hidden
from people who cannot view that member's activity. Its score still enters the
Bottle summary.

## External reviews

Application code and APIs call these records `externalReview`. They call a
Peated user's scored opinion `memberReview`. Do not use the bare name `review`
for either record in shared schemas, serializers, routes, or exported types.

The physical external-review tables still use the old SQL names `review` and
`review_article`. The schema maps them to `externalReviews` and
`externalReviewArticles` so new application code does not inherit that
ambiguity.

An external score enters a Bottle summary only when all of these rules are
true:

- The review is public.
- The source policy allows score display.
- The review belongs to an active exact Bottle.
- The source supplied a whole-number value on a 100-point scale.

The shared SQL rule lives in `externalReviewScores.ts`. Imports store the value,
scale, and display text exactly as published. Other scales remain visible with
the external review but do not enter the Bottle score.

`legacyNormalizedScore` is an old import field. Its SQL column remains
`review.rating`. New writes do not fill it. Public APIs do not expose it, and
summary queries do not use it.

## Bottle summaries

Bottle and BottleGroup summaries store:

- `medianScore`, `minScore`, and `maxScore`
- `memberScoreCount` and `externalScoreCount`
- `tastingBandCounts`, with one count for each tasting band

The shipped `avg_rating` and `rating_stats` SQL columns remain for historical
data. Application code calls them `legacySimpleRatingAverage` and
`legacySimpleRatingStats`. Current summaries do not read or update them.

`scoreCount` is the sum of the two score counts in the API. The score and range
stay `null` until at least 20 counted scores exist. The median uses the lower
middle value when the count is even.

Exact Bottle summaries use only that Bottle. BottleGroup summaries combine all
active members. They exclude retired Bottles.

Writes queue the existing Bottle summary job after the database change finishes. This
includes member review writes, tasting band changes, external review imports,
moderation changes, assignments, and source score-policy changes. Large policy
changes queue work in batches.

Run `pnpm cli bottles fix-stats [bottleIds...]` to rebuild active Bottle and
BottleGroup summaries. The command also checks each stored external score count
against the shared external-review rule.

## Recommendations

Recommendations use distinct-member overlap on Outstanding and Unicorn
tastings. Review scores do not affect recommendations.
