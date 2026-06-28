# Sources

## Inventory

| Source                                                 | Trust         | Contribution                                                                |
| ------------------------------------------------------ | ------------- | --------------------------------------------------------------------------- |
| `AGENTS.md`                                            | repo policy   | package manager, core commands, API host, docs index, test-vs-QA boundary   |
| `package.json`                                         | repo manifest | root scripts, ports implied by dev docs, CLI wrappers                       |
| `docs/development/local-ui-verification.md`            | repo doc      | local API/web ports, fallback ports, login, agent-browser notes             |
| `docs/development/orpc-routes.md`                      | repo doc      | API route shape, auth/error/manual route context                            |
| `docs/development/orpc-client.md`                      | repo doc      | UI-to-API caller behavior and error handling                                |
| `docs/development/backend-testing.md`                  | repo doc      | confirms manual QA is separate from automated backend test policy           |
| `docs/development/frontend-testing.md`                 | repo doc      | confirms browser behavior surfaces and Playwright/agent-browser distinction |
| `apps/cli/src/program.ts`                              | source        | Commander CLI entrypoint and runtime shutdown behavior                      |
| `apps/cli/src/commands/index.ts`                       | source        | CLI command domains                                                         |
| `apps/cli/src/commands/users.ts`                       | source        | stable local QA user and bearer token commands                              |
| `.agents/skills/skill-writer/**`                       | local skill   | authoring, validation, SPEC/SOURCES requirements                            |
| `.agents/skills/dotagents/references/configuration.md` | local skill   | local skill discovery layout and `path:` behavior                           |

## Decisions

| Decision                           | Status  | Rationale                                                                     |
| ---------------------------------- | ------- | ----------------------------------------------------------------------------- |
| New skill needed                   | adopted | No existing local QA skill was present.                                       |
| Root is `skills/peated-qa`         | adopted | Existing repo-owned skill uses `skills/` and symlinks into `.agents/skills/`. |
| Inline layout                      | adopted | One compact checklist covers most manual QA invocations.                      |
| No runtime references              | adopted | User requested low prose; branches are short enough to scan.                  |
| Include `SPEC.md` and `SOURCES.md` | adopted | New skill with durable maintenance contract and provenance.                   |
| Focus on manual QA only            | adopted | Tests/lint are already covered by repo docs and AGENTS instructions.          |
| Production API is comparison-only  | adopted | Public reads may be anonymous, but local QA should avoid production writes.   |
| Stable local QA user               | adopted | Reuse `qa@example.com` to keep protected API QA data bounded.                 |

## Coverage Matrix

| Dimension           | Status   | Evidence                                                     |
| ------------------- | -------- | ------------------------------------------------------------ |
| API runtime         | complete | `local-ui-verification.md`, `orpc-routes.md`, `AGENTS.md`    |
| CLI runtime         | complete | `package.json`, `apps/cli/src/program.ts`, command exports   |
| UI runtime          | complete | `local-ui-verification.md`, `frontend-testing.md`            |
| Auth/moderator flow | complete | `local-ui-verification.md`, `apps/cli/src/commands/users.ts` |
| Agent-browser usage | complete | `local-ui-verification.md`                                   |
| Evidence reporting  | complete | QA handoff needs from user request                           |
| Version variance    | low      | Local ports/scripts may drift; maintenance note added.       |

## Trigger Sets

Should trigger:

- "QA my Peated API change manually"
- "use browser-agent to verify this UI flow"
- "how should I smoke test this CLI command"
- "manual QA API CLI UI changes locally"

Should not trigger:

- "run tests and lint"
- "write a backend test"
- "review this PR for bugs"
- "QA a non-Peated project"

## Open Gaps

- No dedicated manual QA fixture catalog exists.

## Changelog

- 2026-06-28: Switched protected API QA guidance to a stable CLI-managed user.
- 2026-06-28: Created initial Peated manual QA skill.
