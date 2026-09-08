## Context

Peated stores Brand, bottler, and distiller as separate Bottle relationships. The current rule is broad enough to assign a parent company named on an official release. The web UI then says “Bottled by,” and distillery catalogs treat the Bottle as an outside release.

The regression came from solving a real but narrower problem: an independent bottler can also be the consumer Brand. Proof and Wood, Compass Box, and SMWS must not lose their bottler relationship merely because the same Entity fills both fields. The fix must preserve that behavior without treating Suntory, Diageo, or another official producer or owner as the bottler of its own portfolio.

## Goals / Non-Goals

**Goals:**

- Give `bottler` one consistent, product-specific meaning across catalog docs, classifier prompts, extraction guidance, user-facing form help, tests, and production data.
- Preserve Brand-and-bottler equality for evidenced independent bottlers.
- Keep official releases free of owner or producer bottler assignments.
- Repair affected production Bottle groups through an explicit, evidence-backed manifest with readback verification.

**Non-Goals:**

- Record the company or facility that physically operated a bottling line.
- Infer a bottler from ownership, distribution, importing, label copyright, or a corporate house mark.
- Change the Bottle or Entity database schema, API field names, or Entity kind model.
- Re-audit every other Bottle field while correcting this bounded relationship defect.

## Decisions

### Bottler means independent release responsibility

Set `bottler` only for a business that independently selects and releases whisky made by another producer. A name on the package or product page is not enough.

This keeps the field useful for the distinction drinkers expect from “Bottled by.” Using a broader house-mark definition creates redundant data already represented by Brand, distillery, and owner.

Alternative considered: rename the field to `releaseCompany` and include official owners. This would change the product concept and API while still duplicating ownership, so it is rejected.

### Official releases leave bottler empty

An official release from a Brand or distillery has `bottler: null`. A corporate name such as “Suntory Whisky” does not make Suntory the bottler of Hakushu or Hibiki. Physical packing, importing, and distribution are not enough.

Alternative considered: assign the producing distillery as bottler for every official release. That would add no independent identity information and would make Bottle lists repeat the producer as “Bottled by.”

### One Entity may still fill Brand and bottler

The same Entity may fill both roles. Compass Box can be the Brand and bottler; SMWS and Proof and Wood can too. Product evidence decides the role, not Entity kind or whether the IDs match.

### Encode both positive and negative examples

Shared instructions will state the rule directly. Tests will pair Suntory official releases with existing same-Entity Bottler cases.

### Correct production data by Bottle group

Because bottler uses shared editing semantics, the cleanup manifest will resolve each affected Bottle and BottleGroup before writing. It will classify assignments as confirmed wrong, confirmed valid, or unresolved; record evidence; and list every affected Bottle ID. Writes will patch explicit representative Bottle IDs in small batches only after approval. Each group and member Bottle will be re-fetched after its patch.

The initial inventory starts with Entity E1383 (`Suntory`) and expands to other likely owner/official-producer assignments using relationship and evidence checks. Entity kind, name similarity, or ownership alone can identify candidates but cannot authorize a correction.

## Risks / Trade-offs

- **Classifier overcorrects and removes real independent bottlers that also own a Brand** → Preserve positive regressions where Brand and bottler share one Entity and require evidence of the independent role.
- **A company name is mistaken for a Bottler** → Require evidence of the Bottler role and cover Suntory in tests.
- **A shared patch changes more Bottles than the inventory lists** → Read edit context immediately before writing, reconcile all group members, and stop on any mismatch.
- **Existing incorrect assignments are reintroduced before deployment** → Land and deploy the contract and classifier correction before running production cleanup.
- **Candidate discovery is mistaken for proof** → Keep unresolved candidates unchanged until product evidence establishes the role.

## Migration Plan

1. Update the identity and catalog documentation, classifier instructions, extraction guidance, and form help.
2. Add and run focused deterministic tests and model fixtures without making live model calls unless needed.
3. Deploy the rule correction so automated catalog work stops adding official producers as bottlers.
4. Produce a read-only manifest of affected Bottle groups, starting with Suntory E1383, and obtain explicit approval for the exact IDs.
5. Patch confirmed wrong groups in small batches, re-fetch every member, and reconcile Bottle and Entity counts.
6. Roll back a bad data batch by restoring the manifest's recorded previous `bottler` IDs through the same reviewed API path. Revert instruction changes only if regressions show the new boundary removes evidenced independent bottlers.

## Open Questions

None. Product evidence may leave individual production candidates unresolved, but that does not change the contract.
