## Why

The Add Bottle flow currently treats a missing catalog target as a separate
"create first, choose action second" step. This adds friction and obscures the
real user intent: add the bottle to Library, log a tasting, or create/view the
catalog bottle.

## What Changes

- Defer catalog bottle or release creation until the user clicks a terminal
  action.
- Keep create proposals as preview-only resolver results until that terminal
  action is chosen.
- Show the same action set for existing matches and create proposals, except
  the third action is `View Bottle` for existing targets and `Create Bottle` for
  missing targets.
- Make `Add to Library` and `Log Tasting` implicitly create the proposed target
  before continuing when Peated does not already have it.
- If action-time creation discovers that the target already exists, continue the
  selected action against the existing target instead of creating a duplicate.
- Preserve the current no-manual-entry behavior for this flow; manual catalog
  entry remains out of scope for this change.

## Capabilities

### New Capabilities

- `add-bottle-flow`: Deferred create-proposal commit behavior for the Add Bottle
  resolver and its Library, Log Tasting, and Create/View actions.

### Modified Capabilities

## Impact

- Web Add Bottle resolver states and action rendering for create proposals.
- Web Add Bottle action handling for Library, Log Tasting, and Create/View.
- Existing create-proposal API usage from photo identification.
- Duplicate/conflict handling when a proposed target is created at action time.
- Targeted tests and local UI checks for existing-match and missing-target
  branches.
