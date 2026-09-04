## Context

The first Peated tasting form stored a number from 0 through 5 and presented
quarter-star steps. The 2025 simple-rating migration retained that number and
derived Pass for values through 2, Sip for values above 2 through 4, and Savor
for values above 4. The current tasting model stores one of five named ratings
and deliberately leaves both historical columns out of current behavior.

A read-only production API inventory found 232 visible historical star ratings.
Every value was a quarter-star increment, every simple rating matched the 2025
conversion, and none of those rows had a current rating. The existing tasting
API cannot expose private members outside the current account's visibility, so
the administrator preview operation is the authoritative production inventory.

## Goals / Non-Goals

**Goals:**

- Recover current tasting ratings from historical stars with a fixed,
  reviewable mapping.
- Never overwrite a current rating.
- Preserve the historical values as evidence.
- Make the production operation previewable, stale-safe, repeatable, and easy
  to verify.
- Refresh every affected Bottle and BottleGroup summary.

**Non-Goals:**

- Convert historical values into member review scores.
- Convert zero, out-of-range numbers, or values outside quarter-star steps.
- Delete either historical rating column.
- Change the current tasting or member-review write APIs.

## Decisions

### Keep the earlier meaning while adding more detail

Use this mapping:

| Historical stars | Current rating |
| ---------------- | -------------- |
| 0.25–2.00        | Mediocre       |
| 2.25–3.00        | Good           |
| 3.25–4.00        | Very good      |
| 4.25–4.50        | Outstanding    |
| 4.75–5.00        | Unicorn        |

The first range keeps the old Pass population together. The next two divide
the old Sip population, and the final two divide the old Savor population.
This also preserves the current recommendation rule in which Outstanding and
Unicorn replace Savor.

A linear `stars * 20` conversion was rejected because it would label 3.75
stars Mediocre. Rounding stars to five ordinal buckets was rejected because it
would promote old Pass values into Good and old Sip values into Outstanding.

Zero stays unchanged because the old form displayed zero as “Not rated.” Values
outside 0–5 or outside quarter-star steps are also reported without being
changed. Peated does not guess when the old value is unclear.

### Keep the rules and database change in tested server code

Keep the star-to-rating function beside the code that reads and changes the
database. The preview reports all old star ratings, the number ready to convert,
the number already rated, and the values that will be skipped. The conversion
changes only tastings whose current rating is empty. It keeps both old values.

Save the selected changes together. Check again that each rating is empty so a
member's newer choice wins. If the saved count differs from the preview, save
nothing and require another preview.

### Provide separate administrator preview and convert requests

Add a GET request that only counts records and a POST request that converts
them. Both require an administrator. The POST body includes
`expectedConversions`, copied from `willConvert` in the preview. The request
stops if the number has changed. The Admin Maintenance page calls both
requests. It loads the preview when the page opens, shows the counts in plain
language, and asks for confirmation before it converts anything. This is a
direct page for one-off repairs, not a general job system or repair framework.

After a successful conversion, start the existing Bottle rating-total update
once for each affected Bottle. Sending `expectedConversions: 0` starts those
updates again without changing any tasting. A queue failure does not change the
successful conversion into a failed response: log the affected Bottle ID,
report how many updates could not start, and let the administrator retry the
updates from Maintenance.

### Keep the source values after migration

Do not clear `legacyStarRating` or `legacySimpleRating`. They provide the
evidence needed to audit the conversion and make the operation reversible.
Current UI and summary behavior continues to read `ratingBand`.

## Risks / Trade-offs

- **The mapping approximates member intent** → Use the prior migration's
  published meaning, retain the exact source value, and document the policy.
- **A current rating could be overwritten** → Select and change only empty
  current ratings, then compare the preview and saved counts before committing.
- **The production set can change after preview** → Require the exact preview
  count in the conversion request.
- **Updating totals can fail after ratings are saved** → Report the failed
  starts and keep a **Refresh Bottle totals** action that starts every affected
  update again.
- **Converted top ratings change recommendations and profile insights** → Treat
  this as intended recovered history and cover the shared mapping in tests.

## Migration Plan

1. Deploy the conversion helper, protected API operations, tests, and
   documentation.
2. Open Admin → Maintenance and review the old star rating preview.
3. Review `notConverted`, `notConvertedValues`, and `alreadyRated`. Stop if the
   counts are unexpected.
4. Confirm the conversion on the Maintenance page. The page sends the previewed
   count with the request.
5. Wait for the Bottle rating totals to update and run the preview again. It
   must report `willConvert: 0` with the same old-star total.
6. Verify Bottle and BottleGroup rating totals and sample public
   tasting pages without exposing private tasting content.
7. Remove the completed repair from the Maintenance page with its temporary API
   requests and conversion code. Keep the Maintenance page, the documented
   mapping, and the old database values.

There is no automatic rollback. The old columns remain available to check the
work, but a later current rating may be a member's new choice. Any rollback must
review the current records rather than clearing ratings from the mapping alone.

## Open Questions

None.
