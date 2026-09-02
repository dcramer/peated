# Code Comments

## Intent

Comments are for non-obvious intent, module ownership, rules, and tradeoffs.

They are not there to narrate obvious code.

## Policy

- Comment non-obvious ownership, rules, and tradeoffs.
- Add a brief JSDoc comment when an exported function or type has an important
  contract that its name and type do not show.
- Do not narrate obvious code or restate a type in English.
- Transitional compatibility branches and fallbacks require a concrete removal
  TODO. Name the legacy state or behavior and the release, issue, or condition
  that removes it. Do not only say "clean up later."

## Exceptions

- If there is no concrete release or condition for removing a compatibility
  path, prefer a hard cutover instead of adding the path.
