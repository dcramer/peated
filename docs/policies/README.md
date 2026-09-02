# Policies

Policies are durable coding rules that apply across the repo. They must not
conflict with code or executable configuration.

Use a policy when the repo must say "this is how we do this here" across
packages or features. Testing belongs in `docs/development/` because its rules
and commands differ by application.

A policy must have one clear concern and owner. It must be enforceable through
review, tests, lint, or a runtime check.

Do not use policies for:

- one feature's design or state changes
- plans, status notes, TODOs, or rollout tracking
- copied schemas, commands, or test inventories
- public product docs

Put feature architecture and non-obvious rules in the owning package, module,
or feature documentation. Code, runtime schemas, exported types, and tests
define the real contract. Temporary plans live under `../../openspec/changes/`
and cannot override policy.

Keep policies short. Use common words, active voice, short sentences, and one
idea per sentence. Keep required domain terms, but explain them when the reader
may not know them. Remove other jargon. State the intent, the default, and only
real exceptions. Update the policy when the repo changes the default. Silence
elsewhere does not create an exception.
