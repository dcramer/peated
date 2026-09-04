# C18: carry an observed batch or lot code separately

**Rejected and reverted.** This experiment added a typed observation field to
image extraction and classifier evidence.

## Problem

C17 reliably removed High Country's package code from `edition`, but the
classifier still promoted the same raw label text back into marketed identity
and chose Bottle 44284. Empty `edition` does not explain what the visible code
means.

## Hypothesis

Add `batch_or_lot_code` to extracted label details and `batchOrLotCode` to image
evidence. The field states that the code was read but the label presents it as
a package observation. The classifier may treat it as an edition only when
product evidence proves that it identifies a marketed release.

## Checks and decision rule

Repeat the C17 image extraction cases three times with Luna high. Require High
Country to return `batch_or_lot_code: Batch No. 23J12` with an empty `edition`.
Require the Midwinter Act/Scene and Willett exact-barrel controls to retain
their marketed identity fields. Record the unstable Pōkeno result separately.

Then run the controlled High Country classifier case three times with the new
field. The earlier extraction-only input selected the wrong Bottle in its first
classifier check. Accept only if the typed observation causes all three runs to
match ongoing Bottle 12825 without more model or web requests.

## Result

High Country returned an empty `edition` and a populated package-code field in
all three extraction runs. It copied the exact code correctly in two runs and
misread `23J12` as `23J13` once. Midwinter Act 10 Scene 4 and Willett Barrel
4769 remained correct in all three runs. Pōkeno was unstable as it was in C17.

The classifier still selected Bottle 44284 in all three focused runs. Across
those runs it used 31,458 input tokens, including 24,076 cached tokens, 2,006
output tokens, 1,228 reasoning tokens, five model requests, two local tool
calls, $0.004733 in estimated model cost, and 29.64 seconds. Median time was
8.30 seconds.

## Decision

Revert the typed field. Luna treated the matching candidate as stronger
evidence than the field, so the new schema added cost and complexity without an
accuracy gain.
