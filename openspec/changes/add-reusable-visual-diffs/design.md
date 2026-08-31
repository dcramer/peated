## Context

Peated captures selected web pages from fixed test data and posts every result
to a pull request. The capture code and comment code are coupled through a
Peated-specific manifest. There is no baseline capture or image comparison.

## Goals / Non-Goals

**Goals:**

- Compare two directories of PNG files without knowing how they were created.
- Produce a small, stable report that another script can publish.
- Use the tool in Peated without an external image service.
- Keep the current privilege split between capture and comment workflows.

**Non-Goals:**

- Manage browser startup or application builds in the comparison tool.
- Store long-term visual history.
- Block pull requests when pixels change.
- Support image formats other than PNG in this change.

## Decisions

### Compare directories by file name

The tool accepts baseline, candidate, and output directories. Matching relative
PNG paths identify the same screenshot. This keeps capture commands outside the
shared boundary and needs no configuration format.

### Emit files and JSON

For each changed pair, the tool writes the baseline, candidate, and pixel diff
PNG files. Added files include only the candidate image. Removed files include
only the baseline image. The tool records these paths in `report.json`. The
Peated comment script uses this report instead of importing comparison code.
It shows before and after first, with the pixel diff in a collapsed section.

The report keeps its version 1 `image` field. It points to the pixel diff for a
changed pair and to the available image for an added or removed file. This lets
the trusted comment job on `main` read a report made by pull request code during
the rollout. The extra `images` field supplies the before and after paths.

### Capture both revisions in the pull request job

Peated captures the selected scenarios from the pull request base revision and
the candidate revision. This avoids durable baseline state and stale baseline
races. The job uploads only the two capture manifests, `report.json`, and the
changed report images. It does not upload the full baseline or candidate image
sets. The trusted comment workflow only reads and publishes that artifact.

The candidate is GitHub's test merge. Its first parent is the exact base used
to create that merge. The workflow derives the baseline from that parent for
both changed-file selection and baseline capture. It does not use the base SHA
recorded earlier in the pull request event because `main` can move while
GitHub prepares the test merge.

### Expose a plain Node module, command, and action

The source lives under `apps/web/visual/diff/` because Peated is its first
caller and already owns the screenshot dependencies. A small bundled action
under `.github/actions/visual-diff/` makes the same comparison available to
other repositories without an install step. The module and action do not
import Peated capture code. They can move to a separate action repository after
another repository adopts them.

### Keep the bundled action reproducible

The action bundle is committed so another repository can use it without an
install step. A test rebuilds the bundle and compares it with the committed
files. The build also writes the required third-party license notices.

## Risks / Trade-offs

- Capturing both revisions takes more CI time. The existing four-scenario limit
  bounds this cost.
- Browser or dependency version changes can produce broad diffs. Both captures
  run on the same runner, and the report stays informational.
- Full-page height changes need padding before comparison. The comparison tool
  treats the added area as changed.
- Images from a pull request artifact are untrusted input. The trusted workflow
  validates report paths and never executes downloaded code.
- The full baseline and candidate images remain on the temporary CI runner.
  This keeps artifact size and exposure limited to files used by the comment.
