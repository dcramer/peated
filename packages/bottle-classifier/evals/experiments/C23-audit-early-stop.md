# C23: stop expensive audits early

**Rejected before a treatment run.** The saved traces do not show an
unproductive loop that can be stopped safely.

## Problem

Two Luna high audits were expensive. The Laphroaig Càirdeas audit used 91,802
tokens, nine model requests, six tool calls, and 109.08 seconds. The Dramfool
Octomore audit used 45,284 tokens, five model requests, three tool calls, and
74.12 seconds.

## Hypothesis

Stop an audit after it repeats a rejected Suggested Change or lower the audit
turn limit. This would be useful only if later turns repeat the same work
without improving the result.

## Trace review

Dramfool made one update proposal without citing the target Bottle. The tool
rejected it. Luna added the required Bottle evidence on its next call, recorded
the correct update, and passed.

Laphroaig made three different proposals:

1. The first cited an image URL that had not been collected as web evidence.
2. The second fixed the citation but tried to overwrite a populated name from
   one image, which the tool correctly rejected.
3. The third removed the unsupported name change and recorded the remaining
   update.

The Laphroaig answer was still wrong because it updated the malformed Bottle
instead of merging it into the complete duplicate. Later turns improved the
proposal but did not solve that identity decision.

## Decision

Do not add an early stop or lower the turn limit. Both traces used later turns
to recover from clear tool feedback. Stopping earlier would reduce cost by
discarding useful recovery and would turn the passing Dramfool case into a
failure. Revisit only if a current trace repeats the same rejected proposal
and reason without changing it.
