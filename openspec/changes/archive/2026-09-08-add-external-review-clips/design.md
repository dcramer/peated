## Context

Review scrapers already inspect the text for each Bottle review, but they
discard it before the shared review import runs. External review cards have a
place for a short line of text. An earlier summary feature added separate model
switches for each source and several tracking fields. That feature was unused
and was removed.

## Goals / Non-Goals

**Goals:**

- Add one small function that accepts review text and returns a short clip or
  `null`.
- Use a low-cost Luna model.
- Save reviews even when no clip is available.
- Allow clip generation to be stopped globally for cost or broken output.

**Non-Goals:**

- Separate model settings or approval for each source.
- A separate background job for clips.
- Stored model history or prompt history.
- Retaining complete publisher prose.

## Decisions

### Keep one small clip function

`createReviewClip(reviewText)` accepts the text for one Bottle review and
returns one string or `null`. It owns the model request and return value. It
does not access the database or know which publisher supplied the text.

The prompt asks for one useful sentence of at most 180 characters. The model
may rewrite the source text. Code accepts only a string within that limit.
There is no source-specific model permission check.

### Keep each Bottle review separate

Scrapers pass a map from their stable review key to the matching review text.
This prevents a multi-Bottle article from using prose about another Bottle.
The text exists only while the review import runs.

### Treat clips as optional

The review import tries to create a clip before it stores the review. Missing
model access, a disabled global setting, a model error, or an invalid result
returns `null`. Review facts and Bottle matching continue normally. An
unsuccessful attempt does not erase an existing clip.

The database stores only the resulting clip. It does not store source text,
model names, prompt versions, or model responses.

### Use one global off switch

`EXTERNAL_REVIEW_CLIPS_ENABLED` defaults to enabled. Operators can disable all
clip calls when cost or broken output requires it. Existing scraper settings
and review publication approval remain unchanged.

### Show clips through existing review views

The external review API returns the optional clip. Bottle review cards show it
in their existing summary area. The community feed prefers the clip and falls
back to the article title when no clip exists.

## Risks / Trade-offs

- A model can write a weak clip. Keep the output short, test real source
  fixtures, and use the global switch if quality drops.
- A model outage can leave new reviews without clips. The review still stores
  and a later scrape can try again.
- The model can run again when a scraper sees the same review. Current scraper
  progress already avoids most unchanged articles. Track refreshes only if
  measured cost proves that it is needed.
- Publisher markup can mix Bottle sections. Adapter fixtures must keep each
  review's text separate before the shared function runs.

## Migration Plan

1. Add the optional clip column with a generated database change.
2. Deploy clip generation and API support. Existing reviews remain valid with
   null clips.
3. Pass review text from current adapters and show new clips.
4. Disable `EXTERNAL_REVIEW_CLIPS_ENABLED` to stop new model calls without
   hiding stored clips.

## Open Questions

None.
