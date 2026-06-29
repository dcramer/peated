# Photo Tasting Entry

## Status

Draft for product and implementation iteration.

Initial rollout should be a new standalone record-tasting experience, not a
replacement for the existing bottle-scoped tasting flow. Build and vet the new
photo-first flow at `/addTasting` while keeping the current
`/bottles/[bottleId]/addTasting` path unchanged.

## Goal

Let a user record a tasting by taking or uploading a bottle photo instead of
starting with text search. The photo-assisted path should identify the bottle,
let the user confirm or correct the match, and then create the same tasting
record the existing search path creates. Like the existing search-based bottle
picker, the photo path must be able to land on either an existing bottle/release
or a new bottle/release proposal. Ideally, a clear label photo should drive the
new-bottle path automatically enough that the user reviews fields instead of
starting from scratch.

The uploaded photo may also become the tasting image. If the flow creates a new
bottle or release, or finds an existing bottle or release without an image, the
same photo may be promoted as that bottle or release image when policy allows.

## Experience Goals

- Photo lookup should feel fast enough to use while standing at a bar or shelf.
- The user should see immediate progress after selecting a photo.
- A slow or uncertain AI result should not block the user from searching
  manually and finishing the tasting.
- Tasting save should prioritize persisting the tasting over slow image
  promotion or post-save verification.

Target latency budgets:

- photo preview appears: under 200 ms after client selection
- upload starts: immediately after selection
- processed pending image stored: under 2 seconds for normal mobile photos
- first useful bottle suggestion: under 5 seconds p50, under 10 seconds p90
- manual-search fallback available: immediately while identification runs
- final tasting save after bottle selection: same order as current tasting save

These are product targets, not hard correctness gates. Instrumentation should
measure each phase separately before optimizing prompts or models.

## Non-Goals

- Do not create tastings directly from model output without user confirmation.
- Do not replace the existing text search flow.
- Do not overwrite existing bottle or release images silently.
- Do not treat vision model guesses as canonical identity without classifier
  review and local candidate search.
- Do not store abandoned upload blobs permanently.
- Do not require users to wait for creation-grade evidence when they are only
  trying to select an existing bottle.

## Product Flow

The new record-tasting flow has two entry paths:

1. Take or upload a bottle photo.
2. Find a bottle manually, using the existing `/search?tasting` path.

The first screen should make photo capture the primary action while keeping
manual bottle search immediately available. This is a new experience for
choosing a bottle before the tasting form, not a modal or minor enhancement
inside the existing bottle detail page flow.

The photo path should identify what bottle target the tasting belongs to before
the user reaches the tasting form. That target may be an existing bottle/release
or a reviewed new bottle/release proposal:

1. User uploads or takes a photo.
2. Server stores a pending processed image.
3. Server extracts label evidence from the image.
4. Server classifies the bottle reference using the existing bottle classifier.
5. UI shows the photo, extracted evidence, and suggested bottle/release outcome.
6. User confirms an existing match, opens full bottle search, chooses another
   candidate, or reviews the proposed new bottle/release fields.
7. Server creates any approved new bottle/release before tasting save when the
   confirmed photo-identification result is a creation proposal.
8. User records tasting notes, rating, tags, serving style, flight, and friends.
9. Server creates the tasting and attaches the pending image if selected.
10. Server may promote the image to a bottle or release image under deterministic
    policy.

Low-confidence photo identification should fall back to seeded full search
rather than forcing a create or match decision.

Manual search from this page should reuse the existing `/search?tasting`
experience instead of embedding a narrower local search. That route already
handles selecting existing bottles and starting the add-bottle path when no
match exists. The user should be able to finish a tasting without taking a
photo. A failed photo lookup should keep a local preview visible on `/addTasting`
with actions to start over or open full bottle search.

## User Experience

The photo path should feel like a faster way to pick the bottle for a tasting,
not like a separate moderation workflow.

### Entry Point

Expose the new experience at `/addTasting` and route general record-tasting
entry points there. Keep existing bottle-scoped deep links that already know the
target bottle or bottling on `/bottles/[bottleId]/addTasting`.

On the new page, show a photo-first choice with manual search as the explicit
fallback:

- A large camera/upload target for photo lookup as the primary action.
- A secondary search callout that opens `/search?tasting` for users who want to
  find or add a bottle manually.
- Recent or suggested bottles can remain below the search path if they already
  exist in the current UI.

The camera action should work well on mobile and desktop:

- mobile: prefer camera capture with upload fallback
- desktop: prefer file picker with drag-and-drop support if practical

### Identification Progress

After a photo is selected, show the image immediately and keep the user on the
same task. The progress state should feel like a centered loading screen with
the selected image as a thumbnail, a spinner, and short whisky-themed loading
messages. Avoid numbered step indicators or implementation-specific phase
names.

If identification takes longer than expected, keep the uploaded photo visible
and let the user switch to manual search without losing the pending image.

The UI should not wait for all enrichment before showing a usable candidate. If
fast extraction and local search produce a strong match, show it while slower web
evidence or secondary extraction continues only when needed for creation or
review.

### Review Result

When identification succeeds, show a compact confirmation view:

- uploaded photo preview
- proposed bottle or release
- confidence or review state in plain language
- extracted key facts, such as brand, expression, age, vintage, ABV, and edition
- a clear primary action to continue with the proposed bottle
- secondary actions to search bottles or start over

The UI should distinguish these photo-identification outcomes:

- matched existing bottle/release
- proposed new bottle
- proposed new release under an existing bottle
- uncertain result requiring manual search

When the result proposes creation, the UI should show the proposed canonical
name and important fields before the user continues. A strong photo result
should prefill as much of the new bottle/release proposal as possible, including
brand, series, expression, category, age, ABV, vintage, release year, edition,
and cask details when visible. The user should not need to understand classifier
internals, but they should be able to spot obvious errors such as the wrong age
statement or brand.

### Low Confidence And Multiple Candidates

If the classifier is uncertain, show seeded search results instead of a hard
failure:

- seed `/search?tasting` with extracted search text when available
- make full bottle search the primary next step
- keep the uploaded photo visible on the result screen until the user starts
  over or leaves for full search

If the photo appears to contain multiple bottles, do not auto-select a result.
Ask the user to choose from candidates or retake the photo.

### Expired Or Failed Photo State

If the pending image expires while the user is still editing, keep the selected
bottle and tasting fields intact. The UI should explain that the photo expired
and offer to re-upload before save.

If the identification request fails, keep the local preview while the page is
open and offer full bottle search plus start over. The user should not have to
restart the tasting entry flow just to try another photo.

### Tasting Form

After the user confirms, manually selects, or approves creation of a
bottle/release, continue to the normal tasting form with the resolved
bottle/release fixed at the top. The uploaded photo should appear in the normal
tasting picture field as the default selected image, as if the user had already
chosen it in that field.

Be careful implementing this default image behavior. The photo picker should not
be a second, independent attachment system that can drift from the form state.
Prefer representing the pending upload as the initial value for the existing
picture control, while preserving the user's ability to replace it, remove it,
or save without a picture. Saving the tasting should attach the image only if the
picture field still references the pending upload at submit time.

If policy allows using the same photo as a bottle or release image, expose that
as a separate secondary choice from the tasting picture field. Hide or disable
the promotion option when policy says promotion is not allowed, such as when the
existing bottle already has an image or the photo is unsuitable as a canonical
bottle image.

For the first standalone version, the form may reuse the existing tasting form
component if it can support a bottle chosen inside the page. Avoid changing the
legacy bottle-scoped form contract unless the change is backwards-compatible for
the existing route.

### Save Result

Saving should prioritize the tasting record. If image attachment or promotion
fails after the tasting is saved, show a partial-success message with a retry
path where possible:

- tasting saved
- image attachment failed
- bottle image promotion failed

The user should not lose notes, rating, or selected bottle because image handling
failed.

### Accessibility

The photo path should remain usable without camera access:

- file upload must be available anywhere camera capture is available
- manual search must remain available before, during, and after photo lookup
- progress and error states should be text-readable, not only spinner-based
- extracted fields and proposed matches should be readable by screen readers
- image attach and promotion choices should be standard form controls

## Storage Model

Use the existing Peated upload bucket and serving path, with a reusable pending
upload prefix.

Recommended object layout:

- `pending-uploads/<id>.webp`
- `tastings/<id>.webp`
- `bottles/<id>.webp`
- `bottle-releases/<id>.webp`

In local development, the same namespaces map into `UPLOAD_PATH`.

Using one bucket keeps credentials, serving, CORS, and local behavior aligned
with existing uploads. A separate temporary bucket is only worth adding if GCS
lifecycle policy, access policy, or cost controls cannot be expressed cleanly by
prefix.

### Pending Upload Records

Add a durable reusable pending upload record instead of passing opaque URLs
through the client:

```ts
pendingUploads {
  id: string;
  createdById: number;
  imageUrl: string;
  namespace: "pending-uploads";
  kind: "image";
  purpose:
    | "photo_tasting_entry"
    | "tasting_image"
    | "bottle_image"
    | "bottle_release_image"
    | "badge_image"
    | "avatar";
  status: "pending" | "attached" | "expired";
  idempotencyKey?: string | null;
  createdAt: Date;
  expiresAt: Date;
  attachedToType?: string | null;
  attachedToId?: number | null;
  objectDeletedAt?: Date | null;
}
```

The pending upload record is the authorization boundary. Only the owner, or an
admin path that explicitly supports it, can use a pending upload.

### TTL And Promotion

Use a short lifecycle TTL for the `pending-uploads/` prefix, for example 24 to
72 hours.
Promotion should copy the object from the pending upload namespace into the
permanent destination namespace and update the destination row to point at the
permanent URL.

Do not rely on "removing TTL" from a pending object. Prefix lifecycle rules are
bucket policy, not durable application state. Copying to a permanent namespace
keeps the state simple:

- pending object can expire at any time after the TTL
- permanent object is not under the pending lifecycle rule
- database rows never point at TTL-managed objects after final save

After successful copy, mark the pending upload `attached`. A cleanup job can
delete attached pending objects early, but correctness must not depend on that
job succeeding.

### GCS Lifecycle Configuration

Production requires a GCS lifecycle rule on the existing Peated upload bucket
that deletes only objects under the pending prefix.

Required behavior:

- bucket: existing configured `GCS_BUCKET_NAME`
- prefix: `${GCS_BUCKET_PATH}/pending-uploads/` when `GCS_BUCKET_PATH` is set,
  otherwise `pending-uploads/`
- action: delete
- age: chosen pending upload TTL, for example 2 or 3 days

The lifecycle rule must not match permanent prefixes such as `tastings/`,
`bottles/`, `bottle-releases/`, `badges/`, or `avatars/`.

This is an operational setup step outside the application migration. The app
should still store `expiresAt` and run cleanup jobs so the database reflects
pending upload state, but GCS lifecycle is the safety net that removes abandoned
objects even if workers are delayed.

### Privacy And Metadata

Server-side processing should strip EXIF and other embedded metadata before
storing pending or permanent images. The image used for OCR or vision should be
the same processed image, or an equivalently metadata-stripped derivative.

Do not store original camera uploads unless a future debugging feature
explicitly requires it and has a separate retention policy. User photos can
contain location metadata, faces, bar backgrounds, receipts, or other incidental
personal information.

## API Shape

### Identify Bottle From Photo

`POST /tastings/photo-identification`

Input:

```ts
{
  file: Blob;
  idempotencyKey: string;
}
```

Output:

```ts
type PhotoIdentificationCandidate = {
  bottleId: number;
  releaseId?: number | null;
  bottleFullName?: string | null;
  fullName: string;
};

type PhotoIdentificationDecision =
  | {
      action: "match";
      matchedBottleId: number;
      matchedReleaseId: number | null;
    }
  | {
      action: "create_bottle";
      proposedBottle: {
        name: string;
        brand: { name: string };
      };
    }
  | {
      action: "create_release";
      parentBottleId: number;
      proposedRelease: {
        edition: string | null;
      };
    }
  | {
      action: "create_bottle_and_release";
      proposedBottle: {
        name: string;
        brand: { name: string };
      };
      proposedRelease: {
        edition: string | null;
      };
    }
  | {
      action:
        | "repair_parent_and_create_release"
        | "repair_bottle"
        | "no_match";
    };

{
  pendingImage: {
    id: string;
    imageUrl: string;
    expiresAt: string;
  };
  imageEvidence: ImageBottleEvidence;
  classification:
    | {
        status: "ignored";
        reason: string;
        artifacts: {
          candidates: PhotoIdentificationCandidate[];
        };
      }
    | {
        status: "classified";
        decision: PhotoIdentificationDecision;
        artifacts: {
          candidates: PhotoIdentificationCandidate[];
        };
      };
  suggestedNextStep:
    | "confirm_match"
    | "confirm_create"
    | "manual_search"
    | "needs_review";
  diagnostics: PhotoIdentificationDiagnostics;
}
```

This route intentionally has no permanent side effects beyond creating the
pending upload record. The public response should return bounded
photo-identification data; full classifier artifacts remain server-owned
diagnostics instead of browser payload.

The route should support idempotency for client retries. If the same user retries
with the same `idempotencyKey`, return the existing pending upload and current
identification state instead of creating duplicate pending objects.

The route should have a bounded timeout. On timeout, return the pending image and
manual-search seed data if available rather than failing the whole entry flow.

### Create Tasting With Selected Picture

For the first standalone version, keep tasting creation on the existing tasting
create route. When the user confirms a photo result, the client should seed the
normal tasting `Picture` field with the uploaded local file. If the user leaves
that field selected, the client uploads it through the existing tasting image
update route after the tasting is created. If the user removes or replaces the
picture field value, submit that current field state instead.

This means the first version should not extend tasting create with pending-image
fields:

```ts
{
  pendingImageId?: string;
  attachImageToTasting?: boolean;
  promoteImageToBottle?: "never" | "if_empty";
  photoIdentificationId?: string;
}
```

Those fields remain a future option if the flow needs server-side pending-image
reuse after leaving `/addTasting`. The current route should:

- create the tasting through the existing deterministic path
- upload the selected picture through the existing image update path when
  selected
- promote the image to a bottle or release only after the tasting and any
  required bottle/release creation are durable
- return partial-success information if image copy or promotion fails after the
  tasting is created
- avoid re-running image identification during final tasting save

Future `photoIdentificationId` support may link the user-confirmed choice back
to the extraction and classifier trace for audit, eval sampling, and debugging.
It should not be required for manual search flows that only reuse a local
picture field value.

## Image Evidence Contract

The image extraction layer should produce evidence, not a final bottle decision.

```ts
type ImageBottleEvidence = {
  sourceImageId: string;
  sourceImageHash?: string;
  extractors: Array<{
    kind: "ocr" | "vision";
    model?: string;
    confidence: number;
    textSpans: Array<{
      text: string;
      confidence: number;
      region?: { x: number; y: number; width: number; height: number };
    }>;
    observations: string[];
  }>;
  fieldCandidates: {
    brand?: EvidenceField<string>;
    expression?: EvidenceField<string>;
    statedAge?: EvidenceField<number>;
    abv?: EvidenceField<number>;
    vintageYear?: EvidenceField<number>;
    releaseYear?: EvidenceField<number>;
    edition?: EvidenceField<string>;
    caskType?: EvidenceField<string>;
    caskNumber?: EvidenceField<string>;
  };
  photoSuitability: {
    isSingleBottlePhoto: boolean;
    labelReadable: boolean;
    suitableAsTastingImage: boolean;
    suitableAsBottleImage: boolean;
    reason?: string;
  };
  conflicts: Array<{
    field: string;
    values: unknown[];
    reason: string;
  }>;
};
```

The bottle classifier should receive the extracted identity and image evidence
as reference context, then run local candidate search and existing decision
policy. Vision or OCR output must not bypass candidate retrieval.

Extraction output should be persisted in a compact trace record with references
to the pending image and classifier run. Avoid storing full prompt payloads or
large duplicate image data in normal database rows.

## OCR And Vision Strategy

Initial implementation should support a single extractor interface and allow
both OCR and vision model backends.

For early eval collection, run both when feasible and record their outputs. Once
we understand real accuracy and cost, production can route:

- OCR-only when the label is clear and identity-critical fields are extracted.
- Vision fallback when OCR misses brand, expression, age, year, or cask details.
- Vision-only when OCR cannot produce useful text but the image appears
  label-like.

The route should expose progress or loading states because the user intentionally
waits for an external AI result in this flow.

### Speed Strategy

Optimize for a useful confirmed bottle quickly, not maximum enrichment before
the user sees anything.

Recommended runtime shape:

1. Client creates a local preview immediately.
2. Client uploads a resized image capped to a practical edge length before
   server processing.
3. Server stores the processed pending image with existing non-resumable small
   upload behavior.
4. Server runs the fastest viable extraction path first.
5. Server searches local bottles as soon as it has brand/name-like text.
6. Server returns a strong local match without waiting for web evidence when
   creation or repair is not needed.
7. Server only uses slower vision, web search, or creation evidence when the
   fast path cannot produce a safe match.

The user should always be able to fall back to manual search while the
identification request is still running.

Do not add extra storage handshakes or queue round trips to the blocking path
unless they are needed for correctness. Background jobs can enrich traces,
verify newly created bottles, or clean up pending images after the user has
continued.

### Cost And Abuse Controls

Photo identification is a user-triggered AI path and needs product-level limits:

- cap input file size before expensive processing
- cap processed image dimensions before OCR or vision calls
- rate-limit photo identification per user and IP
- deduplicate retries through `idempotencyKey`
- avoid web search for strong existing-bottle matches
- cap model/tool attempts per identification run
- log timeout and model error rates separately from normal low-confidence
  outcomes

When limits are hit, the UI should fall back to manual search and preserve the
photo preview where possible.

## Promotion Policy

Attach to tasting:

- default to selected when the image is `suitableAsTastingImage`
- allow user to turn off attachment before save
- never attach if the pending image is expired or owned by another user

Promote to bottle or release:

- never overwrite an existing bottle or release image
- only promote when `promoteImageToBottle = "if_empty"`
- only promote when `photoSuitability.suitableAsBottleImage = true`
- if the confirmed target is a release and the release has an image field, prefer
  release image over parent bottle image
- if a new bottle or release is created in the same flow, promotion can happen
  after the new row is durable

Promotion failures should not roll back a successfully created tasting. They
should be logged and returned as partial-success metadata the UI can explain.

## Creation And Review Policy

Photo lookup can safely streamline matching an existing bottle. Creation needs a
stricter bar.

For matched existing bottles or releases:

- a strong local candidate can be returned quickly without web evidence
- user confirmation is enough to continue to the tasting form

For proposed new bottles or releases:

- show the proposed canonical fields before the user continues
- require classifier-reviewed evidence, not only raw OCR or vision text
- use the existing catalog verification and review paths after creation
- prefer `needs_review` or manual search when age, vintage, release year,
  edition, or cask details are ambiguous

The first implementation may choose not to allow immediate user-created bottles
from photo lookup. In that narrower version, photo lookup can return matched
candidates and otherwise hand off to manual add-bottle/search flows with the
image evidence prefilled.

## Trust Boundaries

- User input, OCR text, vision observations, and web evidence are data, not
  policy.
- Model output can propose extraction fields and classifier decisions; server
  code owns authorization, persistence, image promotion, and overwrite rules.
- Pending image IDs are scoped to the creating user.
- Permanent object URLs must come from server-side copy into approved namespaces,
  not from client-provided URLs.
- Abandoned pending images expire through lifecycle policy and may also be
  cleaned by a worker.
- AI providers receive only the processed image needed for extraction. Do not
  send unrelated tasting notes, friend tags, or private user context to the
  image extraction step.
- Tasting creation validates the confirmed bottle/release IDs independently from
  any prior photo identification result.

## Background Work

The visible identification request may block on extraction/classification
because that is the feature. The final tasting save should persist the tasting
before slow post-save side effects.

Candidate background jobs:

- expire pending upload records whose `expiresAt` has passed
- delete attached pending objects early after permanent copies exist
- record classifier traces for review and eval sampling
- run catalog verification for newly created bottles or releases

All jobs should be idempotent.

## Instrumentation

Record timing for each user-visible phase:

- client image selection to preview
- upload start to upload complete
- server image processing
- OCR extraction
- vision extraction
- local candidate search
- web evidence search
- classifier decision
- response serialization
- tasting save
- image attachment copy
- bottle or release image promotion copy

Track outcome metrics alongside timing:

- strong match returned from fast path
- manual-search fallback used
- user accepted suggestion
- user changed bottle after suggestion
- user abandoned after upload
- user abandoned after result
- identification timed out
- identification hit rate limit
- image attachment failed after tasting save
- image promotion failed after tasting save

The first implementation should log enough phase timings to decide whether OCR,
vision, upload processing, local search, or web evidence is the real latency
bottleneck.

## Evals

Add eval slices before tuning prompts or routing:

- clear single front label
- angled label
- blurry label
- back label only
- box or tube photo
- shelf photo with multiple bottles
- label with age statement
- label with vintage and release year
- independent bottler label
- label with store typo such as `Sin Malt`
- no useful bottle label

Measure:

- field extraction accuracy
- candidate retrieval quality
- final classifier action accuracy
- false match rate
- false create rate
- abstain/manual-search rate
- image suitability accuracy
- image promotion correctness
- latency and model cost
- expired pending image behavior
- retry/idempotency behavior
- rate-limit and timeout fallback behavior

Latency evals should include realistic mobile photo sizes and poor network
simulation. A flow that is accurate but routinely takes long enough for users to
abandon is not successful.

## Implementation Plan

This should ship in small vertical slices. Each slice should leave the existing
search-based tasting flow working and should have integration tests at the API
boundary. Classifier and extraction tests should stay isolated in the classifier
package so they can run without the server database.

### Phase 1: Pending Upload Storage

Add the durable storage foundation without AI or classifier behavior.

Scope:

- add `pendingUploads` schema and migration
- add serializer and route schema
- add upload helper support for the `pending-uploads/` namespace
- add server-side image processing that strips metadata
- add helper to copy pending uploads into permanent namespaces
- add cleanup job for expired pending upload records and objects

API tests:

- uploading a pending image creates an owned pending upload record
- unauthenticated users cannot upload
- users cannot read or attach another user's pending image
- expired pending images cannot be attached
- copied permanent image URLs do not point at the `pending-uploads/` namespace
- cleanup job is idempotent

This phase should not call OCR, vision, or the bottle classifier.

### Phase 2: Image Evidence Contract

Add the classifier-facing image evidence type in isolation.

Scope:

- define `ImageBottleEvidence` and related schemas in
  `packages/bottle-classifier`
- add extractor adapter interfaces for OCR and vision outputs
- add deterministic validation for field candidates, conflicts, and
  photo-suitability
- add fixture helpers for image evidence without server dependencies

Classifier/package tests:

- image evidence schema accepts representative OCR and vision outputs
- invalid confidence, malformed regions, or impossible field values are rejected
- evidence can seed existing classifier input without database or API access
- local catalog classifier evals can consume image-seeded extracted identity

This phase should be testable entirely inside `packages/bottle-classifier`.

### Phase 3: Photo Identification API

Add the user-visible identification route, still without final tasting changes.

Scope:

- add `POST /tastings/photo-identification`
- store a pending processed image
- run extraction through the server whisky label extractor
- call the bottle classifier with extracted identity and image evidence
- return pending image, evidence summary, classification, and suggested next step
- support idempotency keys
- enforce file size, processed image size, timeout, and rate limits

API integration tests:

- valid photo-identification request returns pending image and classifier result
- idempotent retry returns the same pending image/result state
- oversized upload fails before model calls
- timeout returns pending image and manual-search fallback when possible
- rate-limited request falls back cleanly
- route does not create bottles, releases, or tastings

Classifier calls in route tests should use a test adapter/fake at the server
boundary. The classifier's own behavior remains covered by package evals and
classifier tests.

### Phase 4: Tasting Create With Pending Image

Extend the normal tasting creation path to consume pending images.

Scope:

- extend tasting create schema with `pendingImageId`, `attachImageToTasting`,
  `promoteImageToBottle`, and optional `photoIdentificationId`
- attach pending image to tasting by copying it into the tasting namespace
- promote image to release or bottle only under deterministic policy
- return partial-success metadata for image failures after tasting persistence
- link tasting to photo-identification trace when provided

API integration tests:

- creates tasting with attached pending image
- creates tasting without attaching pending image
- rejects pending images owned by another user
- rejects expired pending images while preserving normal tasting validation
- does not overwrite existing bottle/release image
- promotes to empty target image when allowed
- prefers release image over parent bottle image when release target is selected
- returns partial success when image copy fails after tasting creation
- does not re-run extraction or classifier during tasting save

This phase should continue using real route/database integration tests rather
than mocks for persistence behavior.

### Phase 5: UI Photo Entry Path

Build the frontend flow after the API contract is stable.

Scope:

- add camera/upload action next to bottle search in add tasting
- show immediate local preview
- show identification progress states
- show confirmation state for match, create proposal, or manual-search fallback
- seed the uploaded photo into the normal tasting picture field
- allow the user to remove or replace that picture field value
- show partial-success save messaging

UI verification:

- mobile camera/upload path
- desktop upload path
- slow identification with manual fallback
- low-confidence result
- successful existing-bottle match
- uploaded photo appears in the tasting picture field by default
- text does not overflow compact mobile controls

Browser verification should use the local UI verification playbook when auth or
moderator state is needed.

### Phase 6: Creation Path

Only add photo-driven creation after existing-bottle matching works well.

Scope:

- decide whether v1 permits immediate create from photo lookup
- if enabled, route creation through existing bottle/release creation and review
  policy
- show canonical fields before confirmation
- queue catalog verification after creation
- ensure image promotion happens only after durable creation

Tests:

- proposed new bottle requires reviewed classifier evidence
- proposed new release requires reviewed classifier evidence and parent context
- ambiguous age/year/cask fields downgrade to manual review or manual search
- created bottle/release can receive promoted image only when policy allows

This phase should be gated by eval results from real photo fixtures.

## Testing Strategy

Use two separate test layers.

### Server Integration Tests

Server tests should exercise real routes, schemas, database writes, ownership,
and storage helper behavior. They should follow the existing backend testing
policy and avoid replacing durable behavior with broad mocks.

Use focused route tests for:

- pending image upload
- photo identification API boundary
- tasting create with pending image
- cleanup job
- promotion helper
- partial-success behavior

Where external systems would make tests slow or flaky, isolate them at a narrow
adapter boundary:

- fake OCR/vision extractor result
- fake classifier result
- fake storage copy failure

Do not mock the tasting create transaction, ownership checks, expiration checks,
or image promotion policy.

### Classifier And Extraction Tests

Classifier tests should stay in `packages/bottle-classifier` and should not
depend on the server database, GCS, or production APIs.

Use:

- schema tests for `ImageBottleEvidence`
- extractor-output normalization tests
- local catalog data-source fixtures for existing Peated state
- eval fixtures for image-derived bottle identity decisions
- recorded model/search outputs only when intentionally updating eval evidence

These tests should prove that image evidence improves or safely abstains from
bottle identification without changing server inputs merely to make evals pass.

### Rollout Gates

Do not broaden the feature until each gate is satisfied:

1. Pending image storage works with auth, TTL, metadata stripping, and cleanup.
2. Photo identification can return useful existing-bottle matches without
   creating durable bottle/tasting state.
3. Tasting create can attach pending images with deterministic ownership and
   expiry checks.
4. UI can complete a tasting through manual fallback when identification is slow
   or uncertain.
5. Existing-bottle photo evals are stable enough to measure false matches and
   user correction rate.
6. Photo-driven creation is enabled only after evals show acceptable quality and
   review policy is clear.

## Open Questions

- Should photo identification create an explicit review artifact even when the
  user abandons the flow?
- Should users be able to save an unidentified tasting draft, or should manual
  search remain required before saving?
- Should existing bottles without images default to promotion on, or should the
  checkbox default off unless the bottle was created in this flow?
- Should release image promotion happen before parent bottle promotion whenever
  a release is selected?
- What TTL is appropriate for pending images in production?
- Should the first shipped version allow photo-driven bottle creation, or only
  existing-bottle matching plus manual add-bottle fallback?
- What per-user and anonymous/IP rate limits should apply to photo
  identification?
- How much extraction/classifier trace data should be visible to moderators?
