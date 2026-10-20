# Production verification

Verified on 20 October 2026 against `https://api.peated.com` using the
authenticated API. The initial checks below precede the separately approved
Dufftown merge documented at the end.

- All 75 requests in the Bottle/Brand mutation batch completed: guarded reads,
  24 Bottle patches, one Brand patch, and expected-value readbacks.
- All 183 requests in the reference mutation batch completed: guarded reads,
  61 corrections and expected-value readbacks. Seventeen ambiguous references
  and three references with a conflicting vintage/age are unassigned and not
  ignored. Forty-one generated references with rounded strength are unassigned
  and ignored.
- A separate 309-request final readback fetched every starting Bottle, all 102
  reference lists, all 102 alias lists, the Brand and the two imported-consumer
  searches. No pagination remained in the reference lists.
- All 102 Bottle IDs still exist. Names and dates agree with the explicit
  patches. Other reviewed identifying and production fields are unchanged.
- Brand, distiller, Bottler, Series and group IDs are preserved. Each starting
  Bottle still has its own one-Bottle group. The Brand count remains 102 and
  its status is `discontinued`.
- Images and their existing attribution fields are unchanged. There are 96
  images and six missing images; no new image provenance was asserted.
- Tasting counts, public review/tasting counts and score counts are unchanged.
- All 61 corrected references disappeared from the old Bottle reference lists.
  The other 269 assigned references retained their assignments. No new
  references or public aliases were introduced by the renames.
- The 11 visible Rare Malts prices retain their IDs and Bottle assignments.
  The external-review name search remains empty. Hidden prices are excluded by
  the API listing endpoint and were not claimed to be inventoried.

The work list has **109 rows**: 45 `update`, 49 `no change`, 11 `unresolved`,
one `merge`, and three `out of scope`. An `update` row can mean a Bottle field
correction or an import-reference correction. Two rows with applied field or
reference corrections retain `merge` or `unresolved` status because their
duplicate disposition takes precedence. There are 24 Bottles with direct field
changes, 61 corrected reference records and one Brand status change.

The reference work list now has **331 rows**: 61 `update`, 252 `no change`, 17
`unresolved`, and one `create` from the approved merge. The unresolved rows comprise three protected ambiguous canonical
names and 14 references attached to the five disputed existing Bottles.

## Approved Dufftown merge

The user explicitly approved merging **B63827 into B49692** on 20 October 2026. Both records were re-fetched with expected identifying fields and update
timestamps before the merge. The current live API schema was checked again.
The production merge and all eight surrounding reads completed successfully.

- **B49692 survives. B63827 now resolves to B49692** through the API's stored
  tombstone redirect.
- Retailer listing **12057961** moved from B63827 to B49692, preserving its ID
  and product URL. It appears in the survivor's price list and latest price.
- The survivor retained its name, vintage, age, strength, bottling/release
  dates, image, image attribution fields, distiller E366568 and group 22652.
- Zero tastings and review scores remain zero. No public alias was added.
- The three existing Dufftown references were retained. The merge added the
  exact canonical reference **39316**, `Rare Malts Selection Dufftown-Glenlivet`,
  assigned to B49692. There are now 270 assigned references in the reviewed set.
- Brand E366603 now reports **101 active Bottles**. The work list keeps its
  historical B63827 row with the completed merge and survivor recorded.
- There are now 95 active Bottle images and six missing images. B49692 kept its
  original image; no image upload or new provenance claim was made.

B49739 and B49670 remain separate because the Brora 1995/1996 date distinction
has not been settled. No independent deletion or Entity merge was performed.

No application code changed. Production readbacks provide the relevant
verification; application tests and typechecks were not run.
