---
name: agent-design-review
description: Designs, reviews, and iterates on LLM agents and agent-like workflows. Use when asked to "design an agent", "review this agent", "improve our system prompt", "optimize prompts for caching", "improve tool calling", "reduce hallucinated tool calls", "add structured outputs", "decide if this should be multi-agent", "reduce false positives", "tune agent thresholds", or "build evals for this agent". Covers architecture choice, cache-friendly prompt templates, tool and schema design, runtime loops, trust boundaries, and eval-driven iteration.
---

# Agent Design Review

Design or review agents by identifying the success contract first, mapping the real execution path second, and changing the smallest layer that is actually causing failures.

Load only what applies:

| Need | Read |
| --- | --- |
| Choose architecture or multi-agent shape | `references/principles.md` |
| Rewrite prompts or improve cache reuse | `references/prompt-and-caching.md` |
| Draft or rewrite an actual system prompt | `references/system-prompt-templates.md` |
| Draft a provider-specific prompt for OpenAI Responses or Anthropic tool use | `references/provider-specific-templates.md` |
| Improve tool calling, tool schemas, or final outputs | `references/tool-and-schema-design.md` |
| Draft or fix actual tool schemas | `references/tool-schema-examples.md` |
| Review loops, approvals, side effects, or trust boundaries | `references/runtime-and-guardrails.md` |
| Build evals or decide how to iterate | `references/evals-and-iteration.md` |
| Review classifier, matcher, router, extractor, ranker, or moderation agent | `references/classifier-agents.md` |
| Need examples of strong and weak output | `references/review-examples.md` |

## Step 1: Set Mode and Success Contract

Set the task mode first:

- `design`: a new agent or major redesign
- `review`: assess an existing agent and prioritize changes
- `debug`: explain why a current agent is failing and what to change first

Then write a short success contract:

- task the system must complete
- target quality or success metric
- unacceptable failures
- cost and latency budget
- operator or reviewer load constraints
- side effects the system may take
- tools, data sources, and approvals available
- current eval status

If the user asks only for a prompt rewrite, still check whether retrieval, tools, thresholds, or runtime policy dominate the failures.

## Step 2: Choose the Smallest Architecture That Works

Use `references/principles.md`.

Classify the system before proposing changes:

| Pattern | Use when | Avoid when |
| --- | --- | --- |
| Deterministic workflow | The task is mostly rule-based or decomposes cleanly in code | The model must explore or use tools adaptively |
| Single agent | One prompt plus tools can reliably solve the task in a loop | Prompt complexity or tool overload makes behavior unstable |
| Multi-agent system | Distinct roles, tools, or trust boundaries must stay separate | You are adding agents without a measured bottleneck |

Prefer deterministic preprocessing, retrieval, routing, or thresholds before adding more agent autonomy.

## Step 3: Map the Real Execution Path

Write an execution-path summary that names:

- static instructions
- dynamic request context
- deterministic preprocessing and normalization
- retrieval or candidate generation
- tool list and tool descriptions
- loop and stop conditions
- final output schema
- post-model validation or sanitization
- automation thresholds and approval gates
- current evals, traces, tests, or queue feedback

For classifier-style systems, separate deterministic stages from model-driven stages. Do not review only the prompt if code outside the prompt decides most of the behavior.

## Step 4: Identify the Primary Bottleneck

Inspect the highest-risk layer first:

| Layer | Check |
| --- | --- |
| Architecture | Is this over-agentized? |
| Prompt | Is policy explicit, structured, and stable enough for caching? |
| Retrieval | Is the right evidence or candidate set available before the model decides? |
| Tools | Are tool interfaces narrow, typed, and easy to choose correctly? |
| Output contract | Are actions and state machine-checkable? |
| Runtime | Are retries, stop conditions, and fallbacks explicit? |
| Boundaries | Are approvals, auth, and trust boundaries enforced outside the prompt? |
| Thresholds | Do confidence and automation gates map to real consequences? |
| Evals | Can proposed changes be measured? |

Do not default to prompt rewrites if retrieval, thresholds, or post-model guards dominate the failures.

## Step 5: Follow the Relevant Review or Design Path

### Review or Debug Path

1. Summarize the execution path.
2. Name the primary bottleneck.
3. Report findings ordered by severity.
4. Recommend the smallest effective changes first.
5. Add an eval plan that can prove whether the changes helped.

For each finding, include:

- layer
- evidence from prompt, tools, code, traces, or tests
- likely impact on quality, cost, or operator load
- smallest effective change

### Design Path

1. Define the success contract.
2. Justify the architecture choice.
3. Draft a stable prompt template.
4. Define tool contracts and typed outputs.
5. Define loop policy, approvals, and fallback behavior.
6. Define the eval plan before extensive iteration.

If you write a prompt, return a cache-friendly prompt skeleton with clear slots for dynamic inputs rather than an unstructured wall of text.
If you write tool schemas, return concrete schema drafts with parameter descriptions, enums, and required fields instead of only high-level advice.

## Output Format

When reviewing or debugging, produce:

1. Success contract
2. Execution-path summary
3. Architecture verdict
4. Primary bottleneck
5. Findings
6. Suggested changes
7. Eval plan

When designing, produce:

1. Success contract
2. Proposed execution path
3. Architecture rationale
4. Prompt skeleton
5. Tool and schema design
6. Runtime policy and guardrails
7. Eval plan

## Exit Criteria

The work is complete only when:

- the success contract is explicit
- the architecture choice is justified
- the biggest likely bottleneck is named
- prompt, tools, outputs, runtime, boundaries, and eval gaps are each addressed or explicitly ruled out
- recommendations are ordered from smallest effective change to larger redesign
- the eval plan can measure improvement
