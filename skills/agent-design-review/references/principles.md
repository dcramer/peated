# Architecture Principles

Use this reference when deciding whether the system should be a workflow, a single agent, or a multi-agent design.

## Core Rules

1. Start with the smallest architecture that can hit the target quality.
2. Prefer deterministic preprocessing, retrieval, routing, or thresholds before adding more agent autonomy.
3. Prefer a single agent before multi-agent systems.
4. Add evaluator-optimizer or manager-worker patterns only when the evaluation surface or role split is clear.
5. Make stop conditions, fallback paths, and ground truth explicit.

## Recommended Progression

Move through these options in order unless the current step is already insufficient:

1. Prompted workflow with typed inputs and outputs
2. Workflow plus retrieval or routing
3. Single tool-using agent
4. Chained or routed agents
5. Multi-agent system with explicit role boundaries

If a simpler step can plausibly solve the problem, recommend proving it first on evals.

## Pattern Guide

| Pattern | Good fit | Failure sign |
| --- | --- | --- |
| Prompted workflow | Stable procedure, low ambiguity, little exploration | The workflow keeps branching or needing environment feedback |
| Routing | Request types split cleanly into a few categories | Routes are unstable or too overlapping |
| Prompt chaining | One step produces structured input for the next | Intermediate outputs are fuzzy or not validated |
| Single agent with tools | The model must decide what evidence to gather next | The tool set becomes overloaded or tool choice gets unreliable |
| Evaluator-optimizer | Quality can be judged with a clear rubric | The evaluator is subjective or inconsistent |
| Multi-agent | Different prompts, tools, or trust boundaries must stay isolated | More agents are added without a measured improvement |

## Review Questions

- Is there a real need for adaptive tool use, or would a workflow be clearer and cheaper?
- Is retrieval quality the true bottleneck rather than agent reasoning?
- Are roles separated because they reduce complexity, or because the system is fashionable?
- Could prompt templates with typed intermediate state replace another agent hop?
- Are stop conditions and escalation rules explicit, or just implied?

## Design Implications

- Push back on "agent by default" designs.
- Treat multi-agent systems as an optimization for measured overload, not a starting point.
- Keep role boundaries aligned with tool access and trust boundaries.
- Require evidence that extra agent layers improve quality enough to justify cost and latency.

## Sources

- Anthropic, "Building effective agents": https://www.anthropic.com/research/building-effective-agents/
- OpenAI, "A practical guide to building agents": https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/
