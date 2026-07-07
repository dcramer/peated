## 1. Resolver Proposal State

- [x] 1.1 Update Bottle Resolver types so create proposals can be represented as pending resolver outcomes without calling creation.
- [x] 1.2 Preserve create-token, pending-image, preview-url, trace, proposed-name, and warning metadata on pending create proposals.
- [x] 1.3 Ensure start-over, search-again, dismissal, and navigation-away paths do not call the create endpoint.

## 2. Action Rendering

- [x] 2.1 Render Add to Library, Log Tasting, and View Bottle for existing resolver targets.
- [x] 2.2 Render Add to Library, Log Tasting, and Create Bottle for create proposals.
- [x] 2.3 Keep create-proposal context in the bottle card subtext so actions do not need duplicate helper copy.
- [x] 2.4 Remove the create-proposal path that creates a target and then shows a second outcome chooser.

## 3. Action-Time Commit

- [x] 3.1 Add a shared action handler that accepts an existing target or pending create proposal plus the selected action.
- [x] 3.2 For Create Bottle, create or reuse the proposed target and route to the resulting bottle or release page.
- [x] 3.3 For Add to Library, create or reuse the proposed target, then save that exact target to Library using the existing Library add path.
- [x] 3.4 For Log Tasting, create or reuse the proposed target, then open the Log Tasting form using the existing tasting draft path.
- [x] 3.5 Preserve pending scan image reuse for Library and Log Tasting follow-up actions.
- [x] 3.6 If creation succeeds but the follow-up action fails, keep the resolved target in state and surface a retryable error without creating again.

## 4. Existing Target Reuse

- [x] 4.1 Treat server create responses that reuse an existing bottle or release the same as newly created targets.
- [x] 4.2 Verify Add to Library continues against an existing reused target without duplicate catalog creation.
- [x] 4.3 Verify Log Tasting continues against an existing reused target without duplicate catalog creation.
- [x] 4.4 Verify Create Bottle routes to the existing target when action-time creation discovers one.

## 5. Verification

- [x] 5.1 Add focused tests or component-level checks proving create proposals do not call creation before a terminal action.
- [x] 5.2 Add focused tests or component-level checks for create proposal Add to Library, Log Tasting, and Create Bottle continuations.
- [x] 5.3 Add or update tests for existing target Add to Library, Log Tasting, and View Bottle actions to guard against regressions.
- [x] 5.4 Run targeted web typecheck/lint for the touched Add Bottle resolver files.
- [x] 5.5 Use local UI verification at desktop and mobile widths for existing-match and missing-target create-proposal flows.
