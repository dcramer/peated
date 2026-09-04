# C17: separate a visible batch or lot code from a marketed edition

**Rejected and reverted.** This experiment changed only image-extraction
guidance.

## Problem

The extraction contract says `edition` is an exact marketed release field, but
the extractor guidance currently puts every visible batch label or code there.
For High West High Country, that turns the production lot `Batch No. 23J12`
into Bottle identity before the classifier can review its role. Luna then picks
the narrower batch row.

## Hypothesis

For image input, require the visible label hierarchy to present a batch or lot
code as a named product variant before setting `edition`. A code printed with
package facts such as ABV and volume remains in `rawLabelText` but leaves
`edition` empty. This should remove the false identity claim without dropping
the visible code.

## Cases and decision rule

Run Luna high image extraction three times per version for:

- High West High Country Batch No. 23J12, the ordinary-lot target;
- High West A Midwinter Night's Dram Act 10 Scene 4, a marketed edition;
- Pōkeno Single Cask No. 71, a marketed exact-cask control; and
- Willett Family Estate Barrel 4769, another exact-cask control.

Alternate unchanged and changed runs. Record pass count, each extracted field,
input, cached input, output and reasoning tokens, estimated model cost, and
time. Accept only if High Country reliably leaves `edition` empty while the
three marketed-identity controls remain correct, with no material cost or time
increase. Then pass the reviewed extraction through the focused classifier case.

## Result

The extraction change did what it was asked to do. High Country put the code in
`edition` in all three unchanged runs and left `edition` empty in all three
changed runs. Midwinter retained `Act 10 Scene 4` in all six runs. Willett
retained Barrel 4769 in all three changed runs. Pōkeno remained unstable in
both versions and did not establish a regression.

| Measure              |          Unchanged |   Changed |
| -------------------- | -----------------: | --------: |
| Input tokens         |             89,633 |    98,100 |
| Cached input tokens  |             68,262 |    75,042 |
| Output tokens        |             13,796 |    13,998 |
| Reasoning tokens     |             11,497 |    11,465 |
| Estimated model cost | at least $0.023262 | $0.024061 |
| Median case time     |            13.19 s |   13.83 s |
| Total case time      |           466.40 s |  160.39 s |

The unchanged total includes one 300-second Willett timeout with no usage, so
its token and cost totals are lower bounds and its time is not comparable.

The first classifier run with the changed extraction still selected Bottle 44284. Luna read the raw label and promoted the code back into a marketed
edition.

## Decision

Revert the extraction instruction. It changed the intermediate field reliably
but did not improve the final classification.
