# C16: preserve raw photo-label text

**Accepted.** The server now passes the extractor's existing raw label
transcription into classifier image evidence.

## Problem

The image extractor returns both structured Bottle fields and `rawLabelText`.
The photo-identification adapter discarded `rawLabelText` and rebuilt a text
span from structured fields. A printed code omitted from Bottle identity fields
therefore disappeared before classification.

## Change

Use `rawLabelText` as the image-evidence text span when it is available. Keep the
structured-field summary as the fallback for callers without raw text. This
preserves visible lot, batch, bottle, and other label text without asserting
that it belongs in a Bottle field.

## Result

The focused server test proves that `Batch No. 23J12` remains in the text span
when `edition` is empty. Both focused server tests passed in 22.32 seconds, and
the server typecheck passed.

This adapter change makes no model or web request. Its model cost and token use
are zero. It does not decide whether a code is Bottle identity.

## Decision

Keep the change. It repairs evidence loss at the server boundary and lets the
classifier review visible text without forcing that text into `edition`.
