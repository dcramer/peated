# Photo-Assisted Bottle Resolution

## Status

This document describes the current photo-assisted Bottle resolution contract.
Code, runtime schemas, and tests remain authoritative for exact request and
response shapes.

`/addTasting` redirects to `/addBottle?intent=tasting`. The shared bottle flow owns
photo resolution, manual search, Bottle creation, Library continuation, and the
tasting continuation so the same pending image can follow the user's selected
action.

## User Flow

1. The user takes or uploads one Bottle photo, or chooses manual search.
2. The browser shows a local preview immediately, shrinks the photo to fit
   within 1600 × 1600 (the size the server keeps), and sends it to
   `POST /tastings/photo-identification` with a key that prevents a repeated
   request from creating another pending image. A photo the browser cannot
   read is sent unchanged.
3. The server processes the image, creates an owned pending upload, and extracts
   label evidence. One literal stored reference resolves directly. All other
   references run the Bottle classifier once.
4. While that runs, the title under the photo names the current step, and the
   form adds Peated's likely matches and a one-line summary of the label as
   they arrive. Tapping a likely match stops the classifier and continues with
   that Bottle and the same pending photo.
5. Otherwise, the resolver presents either an existing Bottle match or the
   [fallback screen](#fallback-screen).
6. After resolving a Bottle, the main choices are **Rate this bottle** and
   **Add to Library**. View bottle remains secondary. A photo match also shows
   **Not my bottle**, which records the wrong match and opens the fallback
   screen; see [Wrong Matches](#wrong-matches). Extracted label details stay
   collapsed.
   Adding to Library saves immediately, then offers an optional Sealed / Open /
   Empty status selector. Selecting a status saves it. From there, the member
   can rate or view the same Bottle, or find another one.
7. **Rate this bottle** opens a choice between **Log a tasting** and **Write a
   review**, with the selected Bottle fixed and the pending photo attached.
8. Both forms follow **Notes → The pour → Rating/Score**. Notes capture the
   member's words and flavors first. The pour contains serving style, color,
   and separate photo and friend pickers. Back preserves the draft; saving is
   available only on the final step. New reviews start without a score.

The flow never creates a tasting directly from model output. The user chooses
the Bottle and action before any tasting is saved.

## User Experience

- Photo upload is an accelerator, not a requirement. Manual Bottle search is
  available from the initial, failure, and result states.
- Keep the local preview visible while identification runs and when it fails.
- Progress names only generic steps: reading the label, checking Peated,
  checking the web, and comparing details. Web queries and site names stay on
  the server. Each step stays on screen for at least 1.2 seconds so quick
  steps don't flicker.
- After 45 seconds, add "This one is taking a while." under the step.
- Keep progress copy to the step itself. Don't explain what tapping or
  searching will do.
- Progress and error states must be readable without relying on animation,
  color, or camera access.
- A failed or uncertain identification must preserve a path to search or retry.
- Multiple-Bottle or ambiguous evidence must not silently select a Bottle.
- The user may remove or replace the pending image before tasting save.
- General tasting entry uses the shared bottle resolver. Existing
  Bottle-scoped tasting links may continue directly with their known Bottle.
- The main **Find a bottle** action opens lookup without a preset next action.
- Keep normal steps within a phone screen with the keyboard closed. Long
  notes, larger text, and open pickers must remain scrollable.

### Fallback Screen

Every photo that does not lead straight to a Bottle uses one screen: a wrong
match, no match, an approved new Bottle, or a photo we could not check. Only
these parts change:

- **Heading and reason.** The heading says what to do next: the approved new
  Bottle's name, "Is it one of these?" when there are suggestions, or "Find
  your bottle." One line under it says why.
- **Suggestions.** Up to 3 of the likely matches from the `candidates` event,
  minus the matched Bottle. Each row continues with that Bottle in place,
  keeping the photo, and saves it on any wrong-match record. Search is not run
  to fill the list, so every suggestion is one the lookup considered.
- **Main action.** One accent action per screen: the new Bottle's actions when
  one was approved; otherwise the suggestions lead, with **Search bottles** and
  **Add a new bottle** paired below. With nothing to suggest, **Add a new
  bottle** leads when the label was read, and **Search bottles** leads when it
  was not.

A lookup that fails after it started streaming keeps what it sent. Its likely
matches become the suggestions, and **Add a new bottle** and **Search bottles**
start from the label facts and keep the photo, as they do after no match. A
failure before anything arrived offers a blank search and a blank new Bottle.

**Start over** is always a quiet text action. Label details stay collapsed,
with two exceptions: an approved new Bottle shows the photo and label facts
above its actions, because one tap adds it, and a failed lookup keeps the
photo in view.

## Identity And Classification

The [Whisky Identity Model](../architecture/whisky-identity-model.md) governs
every result. Photo resolution identifies one Bottle, never a
BottleGroup or a legacy Bottle/BottleRelease pair.

Image extraction produces evidence rather than catalog authority. OCR, vision,
source text, local candidates, and web results are untrusted observations. The
Bottle classifier may propose a match or creation, while server code owns:

- authentication and authorization;
- pending-upload ownership and expiry;
- request checks and safe handling of repeated requests;
- durable Bottle and tasting creation;
- conflict handling and image promotion; and
- automation and review thresholds.

Existing-Bottle matches may use strong local evidence without web research.
An exact reference produces a deterministic Match without a classifier model call.
Matches and creation use `assessBottleResolution`, the same server assessment
as prices, auctions, and reviews. Creation requires the classifier's complete
`create_bottle` proposal and supporting evidence. Otherwise the flow falls back
to search or manual creation. Photo confirmation, signed tokens, and upload
ownership remain photo-specific permissions, not different identity rules.

## Pending Images

Pending images are durable, owned records rather than client-supplied URLs.
Their current lifecycle is:

- the server resizes and processes the upload before storage;
- the default expiry is 48 hours;
- ownership, purpose, status, deletion state, and expiry are checked before
  every permanent copy;
- the repeated-request key is unique per user and purpose;
- a usable source may be copied to more than one supported destination;
- copying marks the source attached but does not consume it; and
- cleanup expires and eventually deletes the temporary source while permanent
  copies remain in their permanent folders.

The pending record is the authorization boundary. Clients pass its id, never an
arbitrary permanent object URL. Permanent images are server-side copies in the
owning namespace, including `tastings/`, `tasting-drafts/`,
`collection-bottles/`, `bottles/`, or `wrong-photo-matches/`. Tasting drafts keep their copy until the
draft is posted or deleted; see [Tasting Drafts](./tasting-drafts.md).

Image processing must strip embedded metadata before storage or model use. Do
not retain original camera uploads or send unrelated tasting, friend, or user
context to the extraction provider.

## API Boundaries

### Identify From Photo

`POST /tastings/photo-identification`:

- requires an authenticated user who has accepted the Terms of Service;
- rejects oversized files before model work;
- creates a `photo_tasting_entry` pending upload;
- streams progress events (`text/event-stream`), then ends with bounded image
  evidence, classifier output, diagnostics, a suggested next step, and the
  pending image reference;
- returns a signed creation token only for an auto-approved creation decision,
  and a signed wrong-match token only for a match; and
- stops label reading and classification when the client closes the stream.

The progress events, in order:

| Event        | Sent                                    | Contains                                          |
| ------------ | --------------------------------------- | ------------------------------------------------- |
| `photo`      | First, once the pending upload exists   | The pending image reference                       |
| `label`      | When the label has been read            | The image evidence                                |
| `candidates` | Before the classifier model starts      | Up to 5 active Bottles Peated already holds       |
| `step`       | As the classifier starts or ends a tool | `checking_peated`, `checking_web`, or `comparing` |

An exact stored reference skips the classifier, so it sends no `candidates`
or `step` events. Errors before the stream starts, such as an oversized file,
are ordinary error responses. Errors after it starts arrive as a stream error
with the same codes.

The route's only saved product change is the pending upload. A trace may record
safe diagnostic fields, but it is not product data. The route does not create a
Bottle or tasting.

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

### Background Identification For Drafts

A [tasting draft](./tasting-drafts.md#identifying-the-bottle) with a new photo
runs the same label reading and classifier in the background job
`IdentifyTastingDraft`, instead of in the request:

- the draft's own photo, already copied to `tasting-drafts/`, is the input, so
  no pending upload is needed;
- only the photo goes to the model, never the bottle hint, notes, or friends;
- it uses the same per-member limit of 30 photo identifications per hour as
  `POST /tastings/photo-identification`;
- the result is saved on the draft only if the draft still has the same photo;
- it never chooses the draft's Bottle and never creates a Bottle; and
- the member confirms a proposed Bottle with
  `POST /tasting-drafts/{draft}/create-bottle`, which uses the saved proposal
  in place of a signed token and follows the same creation, conflict, and
  catalog image rules as the route below.

### Wrong Matches

When the photo matches an existing Bottle, the identification response
includes a signed `wrongMatchToken`. It names the member, pending image, matched
Bottle, and label facts, so a member can only report a match Peated really made.

`POST /wrong-photo-matches`:

- requires an authenticated user who has accepted the Terms of Service;
- verifies the token and that the pending image is still usable;
- copies the photo to `wrong-photo-matches/` and saves the label facts, the
  matched Bottle, and the request's Sentry trace ID; and
- returns the existing record when the same photo is reported again.

The member then picks a suggestion, searches, or creates a Bottle.
`PATCH /wrong-photo-matches/{wrongPhotoMatch}` saves the Bottle they choose. A
suggestion saves it directly; search and creation carry the record's ID in the
URL, and so does **Change bottle** afterward, so the last pick is the one kept.
Picking the Bottle that was matched withdraws the report: the match was right,
so the record and its photo copy are deleted instead of kept as a false
example. The page then drops the record's ID from the URL, so a reload or a
later change does not try to update a deleted record. A later Bottle merge
can still make both Bottles the same; that marks a duplicate, not a
withdrawal, and the record stays.
Only the reporting member can set it. A failed report or update never blocks
search, creation, or the member's next action.

Access and retention:

- Only administrators can list records, through `GET /admin/wrong-photo-matches`.
  Records exist to build classifier checks. They are not shown publicly.
- The saved label facts are the bounded `imageEvidence` the photo route already
  returns; no prompts, raw model responses, or account details are saved.
- The photo copy is deleted 30 days after the report by the hourly
  `CleanupWrongPhotoMatchPhotos` job. The record, its label facts, and both
  Bottles stay.
- Account deletion deletes the member's records and any remaining photo copies.
- The member is told the wrong match was noted, so they know not to report it
  elsewhere, but not that the photo is kept. The note appears only when the
  report saved.
- Bottle merges move both the matched and the chosen Bottle to the survivor.
  Deleting a Bottle clears that reference.

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
  keeps the local preview and anything the lookup already streamed, and
  offers search or retry.
- Low-confidence, review-only, and `no_match` outcomes open the fallback screen
  with suggestions, search, and manual creation rather than forcing a semantic
  decision.
- A bottle lookup that runs out of time returns the label facts with no match.
- An expired or foreign pending image is rejected before durable creation.
- Catalog-image promotion never overwrites an existing Bottle image.
- A tasting-image copy failure leaves a valid tasting and produces an
  operator-visible error. The current tasting create route does not return a
  warning to the user.

## Verification And Ownership

Use the repository's [backend testing](../development/backend-testing.md),
[frontend testing](../development/frontend-testing.md), and
[local UI verification](../development/local-web-checks.md) guidance.
Model-sensitive behavior belongs in classifier evals; deterministic ownership,
expiry, schema, conflict, and persistence behavior belongs in integration
tests.

Primary owners:

- UI resolver: `apps/web/src/components/bottleResolver/`
- shared continuation: `apps/web/src/app/(layout-free)/addBottle/`
- identification routes: `apps/server/src/orpc/routes/tastings/photo-identification*.ts`
- label reading and classification shared by the route and draft job:
  `apps/server/src/lib/photoIdentification.ts`
- catalog image rules: `apps/server/src/lib/photoCatalogImage.ts`
- draft identification: `apps/server/src/lib/tastingDraftIdentification.ts`
- wrong match records: `apps/server/src/orpc/routes/wrongPhotoMatches/`
- pending image lifecycle: `apps/server/src/lib/pendingUploads.ts`
- pending image schema: `apps/server/src/db/schema/pendingUploads.ts`
- image evidence: `packages/bottle-classifier/src/imageEvidence.ts`

Follow [Logs And Traces](../policies/logs-and-traces.md),
[Sensitive Data](../policies/sensitive-data.md), and
[Model Checks](../development/model-checks.md) when changing the model or tracing parts
of this flow.

## Errors and logs

The form logs each attempt's start, result, duration, request key, file size and
format, uploaded size, next step, and server trace ID. It never logs filenames
or photo contents.
Server traces show whether a failure happened while reading the label or looking
up the bottle. The RPC layer reports errors raised before the stream starts to Sentry; the
route reports errors raised while it streams.

Label reading stops after 45 seconds without automatic retries. Provider outages,
a spent AI budget, connection failures, timeouts, and rate limits return
`SERVICE_UNAVAILABLE`.
Other failures remain server errors. Uploaded photos keep their normal expiry.

The bottle lookup after label reading may run for 3 minutes. This bounds the
model cost of one photo. When it runs out of time, the result has no match and
keeps the label facts, so the form shows what it read and offers search or a
new bottle. The trace marks it with `photo_identification.lookup_timed_out`.

The form stops waiting after 10 minutes and offers search or another upload.
Using a likely match, starting over, or leaving closes the stream. The server
then stops label reading and the bottle lookup and logs the outcome as
`cancelled`.
