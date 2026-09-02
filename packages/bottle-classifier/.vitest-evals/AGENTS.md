# Replay Recordings

- Commit recordings deliberately created or changed for fixtures, harnesses,
  model-tool contracts, or providers.
- Never delete or rewrite recordings as cache. Remove them only when their case,
  tool, or provider is intentionally removed or replaced. Review replacements as
  tool-contract changes.
- Use the narrowest eval command; avoid unrelated recording changes.
- Record only valid, successful tool responses. Provider errors, including
  nested batch errors, must fail validation, never become empty evidence.
