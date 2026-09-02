# Naming

## Intent

Names should use Peated's domain terms and be clear where they are used.

## Policy

- Use the same noun for the same concept in code, storage, and docs.
- Do not introduce a second name for one concept unless a compatibility boundary
  requires it.
- Prefer product and domain names over framework or storage terms.
- Use the module, parent object, folder, and file to keep local names short.
- Name a module for the concern it owns, not the service or adapter it uses.
- Treat `Record`, `State`, `Data`, `Payload`, `Manager`, and `Handler` as warning
  signs. Use one only when that role is the real distinction.
- Define an overloaded term once in its owning documentation. Do not reuse it
  for a nearby concept.

## Exceptions

- Keep compatibility names at external boundaries and old storage keys when a
  hard cutover is not safe.
- Generic names are acceptable inside a small module when the import remains
  clear.
