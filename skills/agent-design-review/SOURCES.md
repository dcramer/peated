# Sources

This file tracks the material synthesized into `agent-design-review`.

## Current source inventory

| Source | Type | Trust tier | Retrieved | Confidence | Contribution | Usage constraints | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `.agents/skills/skill-writer/SKILL.md` | local workflow | canonical | 2026-03-11 | high | Required skill-authoring workflow and output requirements | local repository authority | Baseline workflow |
| `.agents/skills/skill-writer/references/mode-selection.md` | local workflow | canonical | 2026-03-11 | high | Path selection and hard-stop rules | local repository authority | Used to keep this in update mode |
| `.agents/skills/skill-writer/references/synthesis-path.md` | local workflow | canonical | 2026-03-11 | high | Provenance, coverage, and stopping-rationale requirements | local repository authority | Drove this `SOURCES.md` structure |
| `.agents/skills/skill-writer/references/authoring-path.md` | local workflow | canonical | 2026-03-11 | high | Artifact requirements and portability rules | local repository authority | Drove file structure |
| `.agents/skills/skill-writer/references/description-optimization.md` | local workflow | canonical | 2026-03-11 | high | Trigger-quality guidance | local repository authority | Drove description rewrite |
| `.agents/skills/skill-writer/references/evaluation-path.md` | local workflow | canonical | 2026-03-11 | high | Eval artifact guidance | local repository authority | Drove `EVAL.md` |
| `.agents/skills/skill-writer/references/skill-patterns.md` | local workflow | canonical | 2026-03-11 | high | Domain-expert skill structure | local repository authority | Selected pattern |
| `.agents/skills/skill-writer/references/output-patterns.md` | local workflow | canonical | 2026-03-11 | high | Output format guidance | local repository authority | Tightened output contract |
| `.agents/skills/skill-writer/references/examples/workflow-process-skill.md` | local example profile | canonical | 2026-03-11 | high | Coverage expectations for process-heavy skills | local repository authority | Selected example profile |
| `skills/agent-design-review/SKILL.md` | local existing skill | primary | 2026-03-11 | high | Baseline skill content | repository-local snapshot | Starting point |
| `https://www.anthropic.com/research/building-effective-agents/` | external official | canonical | 2026-03-11 | high | Architecture patterns, workflows vs agents, evaluator-optimizer guidance, grounding and control loops | official vendor guidance; may evolve | Strongest source for architecture selection |
| `https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview` | external official | canonical | 2026-03-11 | high | Prompt-structure guidance and prompt-writing rules | official vendor guidance; may evolve | Supports explicit structure and directness |
| `https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags` | external official | canonical | 2026-03-11 | high | Tag-based prompt separation | official vendor guidance; may evolve | Supports clear sectioning |
| `https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview` | external official | canonical | 2026-03-11 | high | Tool-use model and tool-orchestration concepts | official vendor guidance; may evolve | Supports tool-first agent design |
| `https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use` | external official | canonical | 2026-03-11 | high | Tool definition detail, parallel tool use, mistake-proofing | official vendor guidance; may evolve | Supports tool-contract guidance |
| `https://developers.openai.com/api/docs/guides/prompt-caching` | external official | canonical | 2026-03-11 | high | Stable-prefix and cache-friendly prompt layout guidance | official vendor guidance; may evolve | Main caching source |
| `https://developers.openai.com/api/docs/guides/prompt-engineering` | external official | canonical | 2026-03-11 | high | Prompt sectioning, delimiters, examples, direct instruction style | official vendor guidance; may evolve | Supports prompt structure |
| `https://developers.openai.com/api/docs/guides/function-calling` | external official | canonical | 2026-03-11 | high | Tool schemas, strict validation, function interface design | official vendor guidance; may evolve | Supports tool/schema design |
| `https://platform.openai.com/docs/api-reference/responses/list` | external official | canonical | 2026-03-11 | high | Responses request shape, `instructions`, `tools`, `tool_choice`, and `parallel_tool_calls` | official vendor guidance; may evolve | Supports OpenAI-specific templates |
| `https://developers.openai.com/api/docs/guides/agent-builder-safety` | external official | canonical | 2026-03-11 | high | Trust boundaries, untrusted input placement, structured outputs between steps, approvals | official vendor guidance; may evolve | Main boundary/approval source |
| `https://developers.openai.com/api/docs/guides/agent-evals` | external official | canonical | 2026-03-11 | high | Agent evaluation loops and repeatable assessment | official vendor guidance; may evolve | Main eval source |
| `https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/` | external official | canonical | 2026-03-11 | high | Architecture tradeoffs, loop framing, operational concerns | official vendor guidance; may evolve | Architecture and runtime corroboration |
| `https://openai.com/index/introducing-structured-outputs-in-the-api/` | external official | canonical | 2026-03-11 | high | Structured outputs and strict schemas | official vendor guidance; may evolve | Supports typed-output rules |
| `https://developers.openai.com/api/docs/guides/structured-outputs` | external official | canonical | 2026-03-11 | high | Current structured-output guide for JSON-schema-constrained responses | official vendor guidance; may evolve | Supports OpenAI-specific templates |
| `https://platform.claude.com/docs/en/build-with-claude/prompt-caching` | external official | canonical | 2026-03-11 | high | Anthropic cache ordering, `cache_control`, and TTL behavior | official vendor guidance; may evolve | Supports Anthropic-specific templates |
| `https://ai.google.dev/gemini-api/docs/caching` | external official | canonical | 2026-03-11 | medium | Cross-provider cache guidance | official vendor guidance; may evolve | Corroborates common-prefix advice |
| `https://ai.google.dev/gemini-api/docs/function-calling` | external official | canonical | 2026-03-11 | medium | Cross-provider function-calling patterns and controls | official vendor guidance; may evolve | Supports tool restriction and function mode guidance |
| `https://ai.google.dev/gemini-api/docs/function-calling#best_practices` | external official | canonical | 2026-03-11 | medium | Tool-count and tool-description best practices | official vendor guidance; may evolve | Cross-provider corroboration |
| `https://ai.google.dev/gemini-api/docs/structured-output` | external official | canonical | 2026-03-11 | medium | Cross-provider schema guidance and structured output versus function calling distinction | official vendor guidance; may evolve | Supports tool-schema examples |
| `docs/development/schema-conventions.md` | local repo domain | primary | 2026-03-11 | high | Domain contract for the bottle matcher | repository-local policy | Repo-specific anchor |
| `apps/server/src/agents/whisky/guidance.ts` | local repo code | primary | 2026-03-11 | high | Live prompt and policy structure | repository-local snapshot | Repo-specific anchor |
| `apps/server/src/agents/priceMatch/classifyStorePriceMatch.ts` | local repo code | primary | 2026-03-11 | high | Live classifier loop, tools, and limits | repository-local snapshot | Repo-specific anchor |
| `apps/server/src/lib/priceMatchingProposals.ts` | local repo code | primary | 2026-03-11 | high | Thresholds, sanitization, and automation gates | repository-local snapshot | Repo-specific anchor |
| `apps/server/src/schemas/priceMatches.ts` | local repo code | primary | 2026-03-11 | high | Typed output contract | repository-local snapshot | Repo-specific anchor |
| `apps/server/src/lib/priceMatching.test.ts` | local repo tests | primary | 2026-03-11 | high | Existing regression slices | repository-local snapshot | Repo-specific anchor |
| `apps/server/src/schemas/priceMatches.test.ts` | local repo tests | primary | 2026-03-11 | high | Output-validation edge cases | repository-local snapshot | Repo-specific anchor |

## Selected profile

- `workflow-process-skill.md`

Profile requirements satisfied by:

- Preconditions and required context: `SKILL.md` Step 1 success contract
- Ordered execution flow: `SKILL.md` Steps 1-5
- Safety and permission boundaries: `references/runtime-and-guardrails.md`
- Expected outputs and acceptance checks: `SKILL.md` output format and exit criteria
- Failure handling and retry behavior: `references/runtime-and-guardrails.md`, `references/evals-and-iteration.md`
- Escalation and handoff behavior: `references/runtime-and-guardrails.md`, `references/classifier-agents.md`

## Coverage matrix

| Dimension | Coverage status | Evidence |
| --- | --- | --- |
| Architecture choice and anti-overengineering | complete | `references/principles.md`, Anthropic/OpenAI agent guides |
| Prompt structure and caching | complete | `references/prompt-and-caching.md`, OpenAI/Google caching docs, Anthropic prompt docs |
| Tool contracts and structured outputs | complete | `references/tool-and-schema-design.md`, Anthropic/OpenAI/Google function-calling docs |
| Prompt templates and tool-schema examples | complete | `references/system-prompt-templates.md`, `references/tool-schema-examples.md` |
| Provider-specific prompt templates | complete | `references/provider-specific-templates.md`, OpenAI Responses reference, Anthropic tool-use and caching docs |
| Runtime loops and trust boundaries | complete | `references/runtime-and-guardrails.md`, OpenAI safety guidance, Anthropic architecture guidance |
| Eval design and iteration | complete | `references/evals-and-iteration.md`, OpenAI eval guidance, Anthropic architecture guidance |
| Classifier-style agent guidance | complete | `references/classifier-agents.md`, repo matcher anchors |
| Positive, robust, and anti-pattern examples | complete | `references/review-examples.md`, `EVAL.md` |

## Decision records

| Decision | Status | Source basis |
| --- | --- | --- |
| Keep the skill general-purpose for agent design rather than bottle-specific | adopted | Existing skill scope plus user clarification |
| Add prompt-caching guidance as first-class review material | adopted | OpenAI caching guide, Google caching guide |
| Split heavy guidance into focused references instead of one long principles file | adopted | skill-writer design principles, progressive disclosure |
| Treat tool and schema design as core agent design, not secondary details | adopted | Anthropic tool-use guidance, OpenAI function calling, OpenAI structured outputs |
| Add copy-paste prompt templates and concrete tool-schema examples | adopted | User request plus official prompt/tool guidance across providers |
| Add provider-specific request-shape templates for OpenAI and Anthropic | adopted | User request plus official Responses and Messages/tool-use docs |
| Make success contract explicit before review or design work | adopted | OpenAI practical agent guide, workflow-process example profile |
| Keep repo-specific bottle matcher guidance as an optional anchor, not the center of the skill | adopted | User clarification plus existing repo usage |

## Open gaps

1. Computer-use and browser-operating agents are only lightly covered.
   Next action: retrieve current official computer-use and browser-control docs if this repo starts building those agents.
2. MCP-specific tool discovery patterns are not covered in depth.
   Next action: retrieve official MCP and provider-specific MCP guidance if agent tooling expands in that direction.

## Stopping rationale

Additional retrieval was low-yield after the official OpenAI, Anthropic, and Google sources converged on the main patterns:

- stable cached prefixes
- explicit prompt structure
- detailed tool contracts
- typed outputs
- explicit loop and approval policy
- eval-driven iteration

I excluded framework blogs and secondary articles because they added implementation opinions without improving the core guidance quality.

## Changelog

- 2026-03-11: Reworked the skill around online primary-source guidance and split core guidance into focused references for architecture, prompt and caching, tools and schemas, runtime and guardrails, and evals.
- 2026-03-11: Added copy-paste system-prompt templates, bad-vs-good tool schemas, and stronger eval prompts for prompt and schema authoring tasks.
- 2026-03-11: Added provider-specific templates for OpenAI Responses-style agents and Anthropic tool-use agents.
