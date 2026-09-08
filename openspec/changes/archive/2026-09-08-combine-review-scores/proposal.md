## Why

Readers lose useful critic scores because Peated only counts whole-number reviews out of 100. Issue #1006 asks for reviewed site-specific conversions, original score display, and a clear explanation of which reviews count.

## What Changes

- Record a small source comparison before implementing conversion controls.
- Add moderator scoring settings, dated conversion tables, and a preview to each review site's setup.
- Reuse the existing median and publication rules with converted scores.
- Show every original score and explain contributions on bottle pages.

## Capabilities

### New Capabilities

- `external-review-scoring`: Configure, preview, apply, and explain source score conversions.

### Modified Capabilities

None.

## Impact

External-site configuration, review serialization, Bottle statistics, maintenance checks, admin settings, critic display, and ratings documentation. No production source is enabled automatically.
