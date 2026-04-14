# Code Comments

## Intent

Comments are for non-obvious intent, invariants, and tradeoffs.

They are not there to narrate obvious code.

## Policy

- Add comments when behavior is easy to misread, policy-driven, or coupled to a non-obvious invariant.
- Prefer inline docstrings on exported functions and tricky helpers when future readers will need context to change them safely.
- Keep comments short and concrete. Explain why the code exists or what boundary it is protecting.
- Delete or rewrite stale comments immediately when behavior changes.

## Exceptions

- Do not comment obvious transformations or control flow.
- Do not add comments that simply restate the code in English.
