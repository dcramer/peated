# Photo-Assisted Bottle Resolution

## Status

This document describes the current photo-assisted Bottle resolution contract.
Code, runtime schemas, and tests remain authoritative for exact request and
response shapes.

`/addTasting` redirects to `/addBottle?intent=tasting`. The Add Bottle flow owns
photo resolution, manual search, Bottle creation, Library continuation, and the
tasting continuation so the same pending image can follow the user's selected
action.

## User Flow

1. The user takes or uploads one Bottle photo, or chooses manual search.
2. The browser shows a local preview immediately and sends the photo to
   `POST /tastings/photo-identification` with an idempotency key.
3. The server processes the image, creates an owned pending upload, extracts
   label evidence, searches the local catalog, and runs the Bottle classifier.
4. The resolver presents one of three outcomes:
   - an existing Bottle match;
   - an approved proposal for one new, independently complete Bottle; or
   - manual search when the evidence is insufficient or conflicting.
5. After resolving a Bottle, the user may log a tasting, add it to their
   Library, view it, search again, or start over.
6. The tasting continuation loads the normal tasting form with the selected
   Bottle fixed and the pending photo preselected as its picture.

The flow never creates a tasting directly from model output. The user chooses
the Bottle and action before any tasting is saved.

## Experience Contract

- Photo upload is an accelerator, not a requirement. Manual Bottle search is
  available from the initial, failure, and result states.
- Keep the local preview visible while identification runs and when it fails.
- Progress and error states must be readable without relying on animation,
  color, or camera access.
- A failed or uncertain identification must preserve a path to search or retry.
- Multiple-Bottle or ambiguous evidence must not silently select a Bottle.
- The user may remove or replace the pending image before tasting save.
- General record-tasting entry uses the shared Add Bottle resolver. Existing
  Bottle-scoped tasting links may continue directly with their known Bottle.

## Identity And Classification

The [Whisky Identity Model](../architecture/whisky-identity-model.md) governs
every result. Photo resolution identifies one Bottle, never a
BottleGroup or a legacy Bottle/BottleRelease pair.

Image extraction produces evidence rather than catalog authority. OCR, vision,
source text, local candidates, and web results are untrusted observations. The
Bottle classifier may propose a match or creation, while server code owns:

- authentication and authorization;
- pending-upload ownership and expiry;
- schema validation and idempotency;
- durable Bottle and tasting creation;
- conflict handling and image promotion; and
- automation and review thresholds.

Existing-Bottle matches may use strong local evidence without web research.
Creation requires the classifier's complete `create_bottle` proposal and the
approved automation tier. Otherwise the flow falls back to search or manual
creation.

## Pending Images

Pending images are durable, owned records rather than client-supplied URLs.
Their current lifecycle is:

- the server resizes and processes the upload before storage;
- the default expiry is 48 hours;
- ownership, purpose, status, deletion state, and expiry are checked before
  every permanent copy;
- an idempotency key is unique per user and purpose;
- a usable source may be copied to more than one supported destination;
- copying marks the source attached but does not consume it; and
- cleanup expires and eventually deletes the temporary source while permanent
  copies remain in their destination namespaces.

The pending record is the authorization boundary. Clients pass its id, never an
arbitrary permanent object URL. Permanent images are server-side copies in the
owning namespace, including `tastings/`, `collection-bottles/`, or `bottles/`.

Image processing must strip embedded metadata before storage or model use. Do
not retain original camera uploads or send unrelated tasting, friend, or user
context to the extraction provider.

## API Boundaries

### Identify From Photo

`POST /tastings/photo-identification`:

- requires an authenticated user who has accepted the Terms of Service;
- rejects oversized files before model work;
- creates a `photo_tasting_entry` pending upload;
- returns bounded image evidence, classifier output, diagnostics, a suggested
  next step, and the pending image reference; and
- returns a signed creation token only for an auto-approved creation decision.

The route's only durable product side effect is the pending upload and its
diagnostic trace. It does not create a Bottle or tasting.

### Create Approved Bottle

`POST /tastings/photo-identification-create`:

- requires a verified authenticated user who has accepted the Terms of Service;
- verifies the signed token, user, pending upload, and automation decision;
- creates or safely reuses one independently complete Bottle;
- returns `409 CONFLICT` when canonical duplicate protection finds a competing
  Bottle; and
- promotes a suitable photo only when a new Bottle was created and its catalog
  image slot is still empty.

Catalog-image copy failure is a non-fatal warning after Bottle creation. The
route does not rerun extraction or classification.

### Create Tasting

Normal tasting creation accepts an optional owned `pendingImageId` alongside
the selected `bottle` id.

The server validates the pending image before the tasting transaction. After
the tasting commits, it copies the image and updates the tasting. Copy failure
is logged and does not roll back the tasting. A replacement image uses the
normal tasting image-update path after creation.

This ordering is intentional: saved tasting content is more important than a
best-effort attachment.

## Failures And Recovery

- Extraction or classification failure returns an identification error; the UI
  keeps the local preview and offers search or retry.
- Low-confidence, review-only, and `no_match` outcomes route to manual search or
  manual creation rather than forcing a semantic decision.
- An expired or foreign pending image is rejected before durable creation.
- Catalog-image promotion never overwrites an existing Bottle image.
- Post-commit tasting-image failure leaves a valid tasting and produces an
  operator-visible error plus user-facing partial-success messaging where the
  UI owns it.

## Verification And Ownership

Use the repository's [backend testing](../development/backend-testing.md),
[frontend testing](../development/frontend-testing.md), and
[local UI verification](../development/local-ui-verification.md) guidance.
Model-sensitive behavior belongs in classifier evals; deterministic ownership,
expiry, schema, conflict, and persistence behavior belongs in integration
tests.

Primary owners:

- UI resolver: `apps/web/src/components/bottleResolver/`
- shared continuation: `apps/web/src/app/(layout-free)/addBottle/`
- identification routes: `apps/server/src/orpc/routes/tastings/photo-identification*.ts`
- pending image lifecycle: `apps/server/src/lib/pendingUploads.ts`
- pending image schema: `apps/server/src/db/schema/pendingUploads.ts`
- image evidence: `packages/bottle-classifier/src/imageEvidence.ts`

Follow [Observability](../policies/observability.md),
[Data Redaction](../policies/data-redaction.md), and
[Evals](../policies/evals.md) when changing the external-model or tracing parts
of this flow.
