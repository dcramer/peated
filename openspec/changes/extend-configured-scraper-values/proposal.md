## Why

Live local previews show that configured rules can find the right pages but
cannot preserve several common source-owned values. Review sources need bounded
text selection and simple title cleanup, while small shops often publish a
fixed bottle volume or omit a producer prefix from each product heading.

## What Changes

- Add safe, declarative value operations for fixed text, literal text cleanup
  and additions at either end, and joining selected elements whose text starts
  with an allowed prefix.
- Store these rules under a new rules version so existing revisions keep their
  current parsing behavior.
- Teach manual editing, AI suggestions, previews, and collection to use the new
  version through the same parser and validators.
- Cover the exact Whisky Study, Whisky Saga, and small price-source cases found
  by local no-write previews.
- Keep arbitrary scripts, regular expressions, cross-origin reads, and
  source-specific code out of saved rules.

## Capabilities

### New Capabilities

- `configured-scraper-value-rules`: Safe value selection and small text
  operations for database-managed scraper revisions.

### Modified Capabilities

None.

## Impact

This affects configured scraper rule schemas, versioned parsing, AI setup
schemas and prompts, the admin rules editor, preview output, and deterministic
parser/runtime tests. Existing version 1 revisions remain unchanged. No
database migration or new network permission is required.
