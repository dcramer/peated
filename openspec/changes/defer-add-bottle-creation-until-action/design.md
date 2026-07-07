## Context

The Add Bottle flow already separates existing-match actions from create
proposal handling. Existing matches can Add to Library or Log Tasting directly.
Create proposals currently create the target first, then return to a chooser
state. That is backwards for the intended interaction: the resolver should
preview the proposed target, then creation should happen only as part of the
user's chosen terminal action.

The photo identification create endpoint already creates or reuses classifier
create decisions and returns a concrete bottle/release target. The server-side
create helpers already convert deterministic duplicate creation into existing
target ids. The change should therefore move the client-side commit point
without introducing fuzzy matching or a new manual-entry branch.

## Goals / Non-Goals

**Goals:**

- Keep create proposals non-persistent while they are being previewed.
- Render action choices for create proposals: Add to Library, Log Tasting, and
  Create Bottle.
- Keep existing matches on Add to Library, Log Tasting, and View Bottle.
- Create or reuse the proposed target only after the selected terminal action.
- Continue the selected action against a reused existing target when the create
  path discovers a duplicate.
- Avoid showing a second outcome chooser after creation.

**Non-Goals:**

- Add or change manual catalog entry from the Add Bottle resolver.
- Add fuzzy client-side duplicate matching.
- Change classifier identity policy or review policy.
- Change collection image semantics beyond preserving existing pending-image
  behavior through the selected action.
- Rename Log Tasting copy.

## Decisions

### Create proposals become resolver targets with pending commit

Represent a missing target in the resolver as a proposed target that carries the
existing photo-identification create token and display data. Do not call the
create endpoint when rendering that proposal.

Alternative considered: create immediately and hide the resulting chooser. That
still persists abandoned proposals and does not satisfy the product invariant.

### Terminal actions own creation

Add a shared action path for resolver outcomes:

- Existing target + Add to Library: add the existing target.
- Existing target + Log Tasting: load tasting metadata and open the form.
- Existing target + View Bottle: navigate to the existing target.
- Create proposal + Add to Library: create or reuse the target, then add it to
  Library.
- Create proposal + Log Tasting: create or reuse the target, then open the Log
  Tasting form.
- Create proposal + Create Bottle: create or reuse the target, then navigate to
  the target detail page.

This keeps the user action as the single commit point and avoids a second
choice screen.

### Reuse existing server create semantics

Use the current photo identification create route for classifier-backed create
proposals. The underlying create helpers already return existing bottle/release
targets for deterministic duplicate cases. The client should treat the returned
target the same whether it was newly created or reused.

If future non-photo create proposals are added, they should follow the same
contract: action-time create returns a concrete target or a deterministic
existing target, then the selected action continues.

### Keep label differences minimal

The action row differs only where the catalog target existence changes the
third action:

- Existing target: `View Bottle`
- Missing target: `Create Bottle`

Add to Library and Log Tasting stay visible for both states. Supporting copy can
explain that the missing-target actions will create the bottle first, but the
button labels should remain focused on the user's selected outcome.

## Risks / Trade-offs

- Creation succeeds but the follow-up Library add fails -> Keep the resolved
  target in state and show the follow-up error so the user can retry without
  creating again.
- Creation succeeds but loading tasting metadata fails -> Keep the resolved
  target in state and show the tasting load error so the user can retry.
- Pending scan image is reused across create and Library/Tasting actions ->
  Preserve existing pending-image ids through action-time create and pass them
  to the same follow-up APIs used today.
- Create proposal token expires before action click -> Surface the existing
  invalid proposal error and offer search/start-over fallback.
- Users may miss that Add to Library or Log Tasting will create a missing
  target -> Use concise subtext near the action row, not an extra blocking
  step.

## Migration Plan

1. Update resolver state/types so create proposals can render action buttons
   without calling creation.
2. Move photo create endpoint calls into the selected action handler.
3. Route the returned or reused target into the existing Add to Library, Log
   Tasting, or View/Create continuation.
4. Remove the post-create chooser path for create proposals.
5. Add targeted tests and UI verification for existing target, missing target,
   duplicate reuse, and abandoned proposal flows.
