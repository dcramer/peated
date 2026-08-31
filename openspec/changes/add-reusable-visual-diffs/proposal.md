## Why

Pull request screenshot comments show complete pages even when most pixels did
not change. Reviewers need a small report that shows only real image changes,
and the comparison should be reusable in other repositories.

## What Changes

- Add a small image comparison tool that accepts baseline and candidate PNG
  directories.
- Write before, after, and diff images with a JSON report for visual changes.
- Capture Peated screenshots for the pull request base and candidate revisions.
- Post only changed visual results in the existing pull request comment.
- Keep visual changes informational. Tool or capture failures still fail CI.

## Capabilities

### New Capabilities

- `visual-image-diffs`: Compare matching PNG files and report only meaningful
  image changes.

### Modified Capabilities

None.

## Impact

This changes the web screenshot scripts and their two GitHub workflows. It adds
small PNG comparison dependencies to the web package. It does not add an
external service or a required visual approval gate.
