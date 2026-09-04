# C15: preserve a composed SMWS cask-code match

**Accepted.** This experiment fixes a deterministic regression introduced by
C09.

## Problem

The image case for SMWS 1.285 contains the separately labeled values
`Society Distillery No. 1` and `Single Cask No. 285`. The SMWS policy correctly
composes `1.285` and selects Bottle 11940. The later general cask-code guard
rebuilds source codes without that composed value and rejects the match.

## Hypothesis

The composed SMWS code is already a verified source identity anchor. Including
it among source cask codes will preserve this valid exact-cask match while the
C09 guard continues to reject uncoded Elijah Craig and Masterson's sources.

## Checks and decision rule

Use a focused deterministic test with the real split-label shape. Keep the C09
uncoded-source tests and its direct cask-code controls unchanged. Then run the
complete deterministic package suite and typecheck.

Accept only if SMWS 1.285 remains a match, both C09 unsafe shapes remain
`no_match`, and all existing checks pass. The change makes no model or web
requests, so its token use and model cost must remain zero.

## Result

The SMWS 1.285 test now matches Bottle 11940 with `identityScope: exact_cask`
and observation cask number `1.285`. The Elijah Craig and Masterson's guards
still reject candidate-only cask codes. All 424 package tests passed, and the
package typecheck passed.

The later full Luna-high run also passed SMWS 1.285. It used 13,773 tokens,
one local catalog call, $0.002284 in estimated model cost, and 13.94 seconds.
Those are normal classifier costs; this code change itself adds no request,
token, web call, or time.

## Decision

Keep the change. It passes an already verified SMWS identity anchor into the
general cask-code check instead of asking Luna to decide the same fact again.
