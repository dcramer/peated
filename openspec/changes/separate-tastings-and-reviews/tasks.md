## 1. Rating Data

- [x] 1.1 Replace the old advanced-rating bands with one shared five-band table
      for the server and web app; add boundary tests for 79, 80, 85, 90, 95, and
      100
- [x] 1.2 Add `tasting.ratingBand` (`rating_band` in SQL); rename the historical SQL columns to
      `legacy_simple_rating` and `legacy_star_rating`; add brief read-only,
      excluded-from-summaries comments beside both Drizzle fields
- [x] 1.3 Add the `member_review` table with one review per member and Bottle,
      an integer score check, optional notes, and timestamps
- [x] 1.4 Add the new median, range, member count, external count, and band
      counts to Bottle and BottleGroup as `tastingBandCounts` while retaining
      clearly named simple-rating history
- [x] 1.5 Remove the unused tasting score and rating preference, generate the
      Drizzle migration, and verify that it renames rather than recreates the two
      historical columns; update test fixtures for the new fields
- [x] 1.6 Name the old normalized external score `legacyNormalizedScore` in
      application code, comment that it is an old import field, and exclude it from
      new public score fields
- [x] 1.7 Rename publication-review application and API names to
      `externalReview` and `externalReviewArticle` while keeping the shipped SQL
      table names unchanged

## 2. Tasting and Member Review Writes

- [x] 2.1 Change tasting API schemas and serializers so new writes accept only
      a valid band or no band while old simple and star values remain readable
- [x] 2.2 Remove Pass/Sip/Savor and score writes from tasting create and update
      routes and recalculate the Bottle summary after a band change
- [x] 2.3 Add member review schemas, serialization, list reads, and create,
      update, and delete routes with member ownership and the existing tasting
      visibility rules
- [x] 2.4 Ask the existing job to recalculate the Bottle summary after member
      review writes; test create, update, delete, ownership, and score validation.
      Test that private reviews are hidden from unauthorized viewers, remain
      visible to permitted viewers, and always count in Bottle summaries
- [x] 2.5 Update Bottle merges to keep the most recently updated review when a
      member reviewed both Bottles; add conflict and tie-break tests
- [x] 2.6 Remove the Simple/Advanced profile setting and active API behavior
- [x] 2.7 Update profile tasting counts, tasting Bottle scans, and tasting
      notifications to use bands and clear band labels

## 3. Bottle Summaries

- [x] 3.1 Define one shared query rule for external reviews that are public and
      have a permitted whole-number native score on a 100-point scale
- [x] 3.2 Rework exact-Bottle summary calculation to count tasting bands and
      calculate the median, range, and separate counts from member and permitted
      external review scores
- [x] 3.3 Apply the same calculation to BottleGroups and keep retired
      Bottles excluded
- [x] 3.4 Update Bottle schemas, serializers, sorting, filtering, search, and
      structured data to use the new summary and the 20-score floor
- [x] 3.5 Recalculate affected Bottle summaries after external reviews are
      imported, reassigned, hidden, or affected by a score-display policy change;
      queue large policy changes in small batches
- [x] 3.6 Add integration tests for which scores count, member and external
      counts, median boundaries, the 20-score floor, repeat tasting bands, and
      BottleGroup results
- [x] 3.7 Recalculate active Bottle and BottleGroup summaries and verify external
      score counts against public reviews that meet the score rules
- [x] 3.8 Replace Savor-based Bottle recommendations with distinct-member
      overlap on Outstanding and Unicorn tastings; keep review scores out
- [x] 3.9 Change manual external-review writes to accept the publication's
      displayed value, scale, and label instead of a normalized score; test native
      100-point and other-scale reviews
- [x] 3.10 Remove normalized-score calculation and writes from external review
      observations, scrapers, imports, and fixtures; keep only explicit legacy
      read coverage

## 4. Web Experience

- [x] 4.1 Replace the tasting rating control with the five-band input and remove
      the rating-system switch and profile setting
- [x] 4.2 Add the Bottle review form for one 100-point score and optional notes,
      including edit and delete behavior
- [x] 4.3 Update tasting rows, review lists, Bottle summaries, release-family
      summaries, and Bottle tables to show the new bands and median score; hide the
      score area below 20 counted scores
- [x] 4.4 Keep old simple and star ratings readable on historical tasting rows
      without including them in new summaries
- [x] 4.5 Show named bands with their ranges in fixed order and do not present
      band counts as percentages, stars, or five-point scores
- [x] 4.6 Add focused component and browser tests, then check the tasting and
      review flows at desktop and mobile widths

## 5. Documentation and Checks

- [x] 5.1 Rewrite the rating architecture, feature guide, public ratings page,
      and API descriptions around tastings with bands and reviews with scores
- [x] 5.2 Run targeted server and web tests, typechecks, lint, and formatting;
      report any full-repository checks left to pull request CI
- [x] 5.3 Update external-review documentation, tests, mocks, and the pull
      request for the clear naming cutover; describe member and external reviews
      as two sources of the same review concept
