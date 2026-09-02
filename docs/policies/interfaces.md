# Interfaces

## Intent

An interface should expose the smallest useful action and make its owner clear.

## Policy

- At exported and module boundaries, prefer a narrow function over a broad
  dependency object or raw service client.
- Return only the IDs, status, or summary that callers need.
- Keep framework and outside-service types inside the module that owns them.
- Add an exported interface only when it represents a stable boundary or
  removes real coupling.
- Do not add wrappers that only rename or forward arguments.

## Exceptions

- Low-level infrastructure may expose mechanism-specific APIs inside its own
  module.
- Test fixtures may expose a small setup function that production code does not
  use.
