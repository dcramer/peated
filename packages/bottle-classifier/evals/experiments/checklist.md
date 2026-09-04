# Classifier improvement checklist

This is the ordered list of work we believe is worth testing. A checkbox means
the item was investigated and documented. It does not mean the change was kept.
The linked result records whether it was accepted, rejected, or left uncertain.

Each classifier experiment uses Luna high and compares one change with the
unchanged Luna high classifier. We keep a change only when the accuracy benefit
is worth its cost, token use, and time. Score-rule fixes are reported separately;
they cannot count as classifier accuracy gains.

## Completed groundwork

- [x] **Record the starting point.** Saved all 102 case outcomes for Luna high,
      Luna xhigh, and Terra medium, with and without web evidence. See the
      [baseline](../README.md).
- [x] **Define the experiment rules.** Record accuracy, incorrect matches, cost,
      tokens, time, and every failure. Repeat focused cases three times per version.
      See the [experiment rules](./README.md).
- [x] **Test a broader release-identity instruction.** **Rejected.** It reduced
      full passes from 19/30 to 13/30 and increased incorrect matches from five to
      eight. See [Experiment 01](./01-release-identity.md).

## Make the measurements trustworthy

Do these before using the suite to judge more classifier changes.

- [x] **M01 — Show the exact field that failed.** **Accepted.** The creation
      check now reports each differing field, expected value, and actual value.
      It does not change scores or make a model call. See
      [M01 results](./M01-exact-field-failures.md).

- [x] **M02 — Resolve known policy conflicts.** **Accepted as a measurement
      correction.** Jameson Cold Brew is an additive-flavor spirit outside the
      classifier's whisky scope. Both observed cases now expect `no_match`, and
      an Ardbeg comparison case verifies current-assignment behavior 3/3 times. See
      [M02 results](./M02-policy-conflicts.md).

- [x] **M03 — Verify disputed names and categories.** **Accepted as test case
      corrections.** Black Label Islay Origin is a blended malt, Hedonism² is a
      blended grain bottled in 2023, and `Whisky` is not part of Maker's Mark's
      stable product name. The shorter Creag Isle Bottle name remains correct.
      See [M03 results](./M03-names-and-categories.md).

- [x] **M04 — Define how supported audit extras are scored.** **Accepted as a
      scoring correction.** Test cases may enumerate exact reviewed operation
      sets containing all required repairs. Other edits and extra findings stay
      strict. Five saved case outcomes changed across six runs. See
      [M04 results](./M04-supported-audit-extras.md).

- [x] **M05 — Use fixed evidence for controlled comparisons.** **Accepted as
      measurement infrastructure.** Give both versions
      the same reviewed source evidence for the focused decision. Run a separate
      live-web check afterward. This removes changing pages and different searches
      from the accuracy comparison while still measuring real web behavior. See
      [M05 results](./M05-fixed-evidence.md).

- [x] **M06 — Fix image extraction for controlled audit comparisons.**
      **Accepted as measurement infrastructure.** Store a reviewed extraction
      for each test case image and give both versions the same result. The Luna
      smoke check used the stored extraction with no image-model request. See
      [M06 results](./M06-fixed-image-extraction.md).

- [x] **M07 — Keep an expected null distinct from a missing value.**
      **Accepted as a measurement correction.** The exact-field judge passed a
      returned `proposedBottle: null` to the subset checker as `undefined`, so a
      correct no-match result failed when the test case explicitly expected null.
      The checker now receives the actual null. See
      [M07 results](./M07-null-vs-missing.md).

- [x] **M08 — Remove a held-out release year.** **Accepted as a
      measurement correction.** The text-only SMWS test case required release
      year 2024 even though the official source page does not state a year and
      the real Peated Bottle is deliberately absent. Age 6 and 56% ABV remain
      required. See [M08 results](./M08-held-out-release-year.md).

## Improve the classifier

Test these one at a time, in this order. Each needs cases that must keep working
and cases with different Bottle names from the failure that led to it.

- [x] **C01 — Preserve why an Entity was retrieved.** **Rejected and reverted.** The prompt says
      `retrievedFor` names the source field, but the classifier supplies only the search
      text. Preserve the relationship being resolved, such as Brand, distiller, or
      bottler. First capture the model's Entity choice before final cleanup so we can
      tell a model mistake from an ID/name cleanup. Test Mars Komagatake, Watchpost,
      Whiskyland, and existing-Entity comparison cases. Expected benefit: fewer duplicate
      Entities and more correct Entity IDs with little token or time change. Mars
      improved from 0/3 to 2/3, but Whiskyland regressed from 2/3 to 1/3 and time
      rose 12.1%. See [C01 results](./C01-entity-retrieval-role.md).

- [x] **C02 — Make audit instructions match the enforced evidence rule.**
      **Rejected and reverted.** The
      prompt allows one label plus a producer title for some populated name or
      edition changes. The proposal tool requires a structured observation or two
      agreeing label images. Choose one rule and express it identically in the
      prompt, tool description, guard, and tests. Expected benefit: fewer rejected
      audit proposals and fewer wasted turns. The first attempt was
      [aborted](./C02-audit-evidence-rule.md) because image extraction was not
      controlled. After M06, the controlled retry removed all three rejected
      target proposals, but doubled rejected proposals in the supported comparison cases
      and raised observed cost and median time.

- [x] **C03 — Stop repeating a rejected audit proposal.** **Stopped without a
      code change.** When the proposal tool
      rejects a field, require new qualifying evidence or removal of that field
      before trying again. End with the supported work when neither is possible.
      Test the one-image audit and valid two-image and structured-observation
      comparison cases. Expected benefit: fewer turn-limit errors, fewer tokens, and less
      time without weakening the evidence guard. The fixed Mannochmore comparison case
      passed with no proposal or rejection, so the historical failure did not
      reproduce. See [C03 results](./C03-rejection-recovery.md).

- [x] **C04 — Establish source identity before showing candidates.** **Rejected
      and reverted.** The failed
      prompt experiment showed that Luna can find evidence describing a candidate
      and then treat it as evidence that the source belongs to that candidate. Test
      a separate source-identity record before candidate choice. It must mark a
      code as marketed, observed only, or unresolved, with evidence. Expected
      benefit: fewer unsupported existing matches. Likely cost: another model pass,
      so this must produce a clear accuracy gain to survive. The separate pass
      classified source traits correctly, but full passes fell from 11/15 to
      9/15, total tokens rose 10.4%, and observed cost rose 58.7%. See
      [C04 results](./C04-source-identity.md).

- [x] **C05 — Account for supported creation fields before returning.** **Stopped
      without a code change.** The final
      instruction already asks for all supported Bottle fields, but Luna still omits
      ABV, release year, and strength flags in some cases. Test an explicit field
      checklist in the model's answer. It should mark each reliable complete-Bottle
      fact as used or deliberately unknown. It must not promote component facts, such
      as Watchpost's component age.
      Expected benefit: more complete creations. Likely cost: more output tokens and
      time, which must be measured. The fixed-evidence check found only one relevant
      omission. Five of six drafts carried all expected individual fields; Mars failed
      only on an Entity ID. See [C05 results](./C05-creation-field-review.md).

- [x] **C06 — Distinguish a different Bottle from the same Bottle needing
      repair.** **Rejected and reverted.** C04's source record was correct, but Luna still treated an
      over-specific candidate as a reason to block creation. Require one compact
      candidate relationship before the action: safe exact candidate, same Bottle
      needing repair, only different Bottles, unresolved identity, or no candidates.
      Test uncoded products beside cask-specific candidates, complete editions
      beside broad candidates, true same-Bottle conflicts, and an exact-match
      comparison case. Expected benefit: turn supported `no_match` results into creations
      without creating duplicates around malformed same-Bottle rows. Likely cost:
      a small increase in output tokens and time. The focused comparison rose
      from 12/18 to 15/18, but the full changed run failed two current
      `no_match` safety expectations and lost six historical passes while
      gaining three on 95 directly comparable cases. See
      [C06 results](./C06-candidate-relationship.md).

- [x] **C07 — Establish catalog eligibility before matching or creating.**
      **Stopped without a code change.**
      Luna high rejected both Jameson Cold Brew cases when web evidence was
      available but matched both without it. Require an explicit `in_scope`,
      `out_of_scope`, or `unresolved` decision before the action. An existing
      Bottle or current assignment cannot establish eligibility. Test additive
      products, ordinary current assignments, and real whisky names with
      flavor-like words. Expected benefit: safer `no_match` result on unsupported
      products without another model request. See the
      [C07 results](./C07-catalog-eligibility.md). Both Cold Brew cases passed
      the unchanged no-web check. The 1792 comparison case instead exposed an unrelated
      product-versus-exact-cask scope wobble.

- [x] **C08 — Prefer one exact source Entity alias.** **Rejected and reverted.** C01 improved Mars by
      changing retrieval context but regressed Whiskyland. Test a narrower
      result check: when exactly one inspected Entity's matched alias equals
      the extracted relationship text, reuse that Entity. Ignore approximate-match scores,
      substrings, and Entity kind, and preserve the model choice when the exact
      match is absent or ambiguous. Expected benefit: fewer duplicate Entities
      without changing model tokens or requests. See the
      [C08 results](./C08-exact-entity-alias.md). The rule corrected the one
      completed Mars draft that needed it, but another Mars run timed out and
      Whiskyland regressed once. The resource comparison was incomplete.

- [x] **C09 — Reject an unverified cask-code match.** **Accepted.** Luna high repeatedly
      matched uncoded Elijah Craig and Masterson's sources to barrel-specific
      candidates whose cask codes exist only in candidate names. Test a narrow
      result check that downgrades such a match to `no_match`. It cannot
      choose another Bottle or create one. Batch numbers, release numbers, ages,
      proof, ABV, and supported exact-cask matches are comparison cases. See the
      [C09 result](./C09-unverified-cask-code-match.md). The guard blocks both
      unsafe match shapes with no model calls or token cost. It preserves the
      exact-cask, batch, release-number, age, proof, and ABV comparison cases.

- [x] **C10 — Resolve a model-chosen exact Entity reference.** **Accepted.** When Luna chooses
      a name that has one exact accepted local Entity resolution, attach that
      Entity's ID and stored name after Luna returns. Do not change the
      relationship or substitute a different chosen name. See the
      [C10 result](./C10-model-chosen-exact-entity-reference.md). The saved Luna
      run had twenty exact choices: nineteen were unchanged and the Mars
      distiller was corrected, with no added model work.

- [x] **C11 — Bypass Luna for an accepted Bottle Reference.** **Accepted.** The
      shared server entry point now reuses a literal assigned Bottle Reference
      before starting the model. Ignored, unassigned, and display-only aliases
      still fall through. Candidate merging also retains the accepted reference
      text. See the [C11 result](./C11-bottle-reference-fast-path.md). Four saved
      Luna attempts spent 28,893 tokens and $0.00352882 repeating two accepted
      decisions; the server path now uses zero model tokens for that shape.

- [x] **C12 — Read the supplied source page first.** **Rejected and reverted.**
      A single routing instruction told Luna to read `reference.url` before
      search when required creation facts were missing. With Firecrawl loaded,
      accuracy stayed 8/12, page reads rose from three to ten, median time more
      than doubled, and one case timed out. It recovered SMWS once but regressed
      Russell's Reserve once, and it read pages for complete or already matched
      comparison cases. See the [C12 result](./C12-source-page-first.md).

- [x] **C13 — Read source pages before Luna for weak input.** **Rejected and narrowed.**
      The focused result rose from 8/12 to 11/12 after M08, but the full suite
      attempted fourteen page reads to improve one test case and nine pages failed
      to load. Classification continued normally after all nine failed reads.
      See the [C13 result](./C13-read-weak-source-page.md).

- [x] **C14 — Read the source page only for a verified title-derived creation.**
      **Accepted.** The missing-local-Bottle SMWS target improved from 0/3 to
      3/3 for supported age and ABV. Nine focused comparison cases passed without a
      preparation read. The full 105-case run made exactly one
      preparation read, for the passing target, and none of its 25 failures used
      the new path. See the
      [C14 result](./C14-read-verified-create-page.md).

## Current stopping point

C09 and C10 improve checks after Luna, while C11 removes model work for Bottle
identity that Peated has already accepted. The
[case-by-case failure map](../failure-map-2026-09-03.md) now owns the remaining
work. It distinguishes fixes in search results, source facts, candidate context,
checks after Luna, and expectations instead of treating every failure as a
prompt problem.

Next test a narrow stable-product-name check. Russell's Reserve repeatedly has
enough source evidence to create `Single Barrel Rye`, but Luna sometimes returns
`Single Barrel`. The check must use an exact source title or accepted Bottle
Reference, preserve deliberate shorter stable names, and avoid assembling a
name from Bottle fields.

## Completion rule

For a measurement item, record the correction and verify it with ordinary tests.
Do not spend on model runs unless it changes what the model sees. Do not count a
measurement correction as classifier accuracy.

For each classifier item:

1. Record the exact change, cases, comparison cases, and success condition before running.
2. Run the focused Luna high comparison three times per version.
3. Review every changed answer and report accuracy, incorrect matches, tokens,
   estimated model cost, web requests, and time.
4. Mark the result **accepted**, **rejected**, or **uncertain** and link its full
   record here. Revert rejected changes.
5. Run the full suite only for a focused result that appears to be a net win.
