# Tool and Schema Design

Use this reference when the task involves tool calling, structured outputs, function schemas, or action selection.

## Tool Design Rules

1. Treat tool definitions as part of the prompt, not an implementation detail.
2. Give each tool a distinct purpose with minimal overlap.
3. Make tool descriptions explicit about when to use the tool and when not to use it.
4. Prefer typed parameters over freeform strings whenever possible.
5. Return normalized structured data instead of prose when possible.
6. Separate read-only discovery tools from mutating tools.
7. Keep the active tool set as small as possible for the current step.

If the runtime supports per-step tool restriction, use it instead of asking the model to ignore irrelevant tools.

## Schema Rules

Use typed schemas for:

- action enums
- ids and references
- status fields
- classifier outputs
- intermediate workflow state

When downstream code depends on a result, avoid parsing freeform prose.
If confidence is included, define how it is used. Decorative confidence fields create noise.
Use strict validation where the runtime supports it.

## Review Questions

- Are there multiple tools that partially do the same thing?
- Are important caveats missing from tool descriptions?
- Would enums, ids, or typed objects reduce misuse?
- Are tool results forcing the model to re-parse narrative text?
- Should the system use a smaller or more curated tool subset per step?
- Is the final output schema strict enough for downstream code?

## Parallel and Mutating Tools

Allow parallel tool use only when the tool calls are independent.
For mutating or high-cost tools:

- require approvals or deterministic policy gates
- validate permissions on the server side
- verify postconditions after execution

Do not rely on prompt instructions alone to keep risky tool calls safe.

## Design Implications

- Prefer a strong search or retrieval tool over asking the model to hallucinate missing evidence.
- Prefer structured intermediate state between workflow steps.
- Prefer schemas that make invalid states impossible or rare.
- Make the easiest tool choice the correct one.

## Sources

- Anthropic, "Building effective agents": https://www.anthropic.com/research/building-effective-agents/
- Anthropic, "Tool use overview": https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview
- Anthropic, "Implement tool use": https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use
- OpenAI, "Function calling": https://developers.openai.com/api/docs/guides/function-calling
- OpenAI, "Structured Outputs": https://openai.com/index/introducing-structured-outputs-in-the-api/
- Google, "Function calling": https://ai.google.dev/gemini-api/docs/function-calling
- Google, "Function calling best practices": https://ai.google.dev/gemini-api/docs/function-calling#best_practices
