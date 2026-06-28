# Peated QA Specification

## Intent

Guide manual QA for Peated changes across API, CLI, and UI surfaces.

## Scope

In scope:

- Choosing manual QA surfaces after code changes.
- Local API, CLI, and web smoke checks.
- `agent-browser` UI verification guidance.
- Runtime commands, local URLs, login notes, and evidence reporting.

Out of scope:

- Automated tests, lint, typecheck, and CI policy.
- Full release verification.
- Production write testing.
- Replacing domain-specific architecture docs.

## Users And Trigger Context

- Primary users: coding agents working in the Peated repo.
- Common requests: manual QA, browser-agent QA, smoke test my changes, verify API/CLI/UI behavior locally.
- Should not trigger for: writing tests only, CI failure triage only, generic QA outside Peated.

## Runtime Contract

- First select changed surfaces.
- Use local runtime commands and URLs from `SKILL.md`.
- Include API/CLI/UI branches only when relevant to the code change.
- Prefer throwaway local data.
- Report evidence, skipped surfaces, and failures.

## Source And Evidence Model

Authoritative sources:

- `AGENTS.md`
- `package.json`
- `docs/development/local-ui-verification.md`
- `docs/development/orpc-routes.md`
- `docs/development/orpc-client.md`
- `apps/cli/src/program.ts`
- `apps/cli/src/commands/index.ts`

Do not store:

- secrets, tokens, passwords, or private user data
- production write credentials
- long copied command output

## Reference Architecture

- `SKILL.md` contains the full runtime checklist.
- `SOURCES.md` contains provenance, decisions, and gaps.
- No runtime references are needed.
- No scripts or assets are needed.

## Validation

- Structural skill validation must pass.
- Manual review must confirm commands and paths exist.
- Runtime guidance must stay compact and manual-QA focused.

## Maintenance Notes

- Update `SKILL.md` when local ports, scripts, login flow, or QA expectations change.
- Update `SOURCES.md` when source docs or decisions change.
- Add references only if the checklist becomes too large to scan.
