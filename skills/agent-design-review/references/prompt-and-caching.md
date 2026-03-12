# Prompt and Caching

Use this reference when designing or reviewing system prompts, developer prompts, or prompt templates.

## Contents

- Cache-friendly prompt layout
- Prompt structure
- Examples and reasoning guidance
- Review checklist

## Cache-Friendly Prompt Layout

Across providers, cache reuse improves when the reusable prefix stays stable.

Default layout:

1. stable system or developer policy
2. stable tool definitions
3. stable output schema
4. stable examples
5. dynamic request context
6. untrusted user or retrieved content

Review for these problems:

- large policy blocks rebuilt on every request
- tool lists that change unnecessarily between runs
- examples or schemas injected after dynamic user content
- untrusted context mixed into the highest-priority instruction section

Prefer prompt templates with explicit slots instead of string-built prompt blobs.

## Prompt Structure

Use explicit sections or tags so the model can distinguish:

- mission
- success criteria
- decision policy
- tool-use policy
- output contract
- examples
- dynamic input

Tell the model what to do, not only what to avoid.
Keep terminology consistent across the prompt, tool docs, and schemas.
When output shape matters, include a typed contract or clear structured template.

Suggested prompt skeleton:

```text
<mission>
What the agent is trying to achieve.
</mission>

<success_criteria>
What counts as success and what failures are unacceptable.
</success_criteria>

<decision_policy>
What to prioritize, when to abstain, when to escalate.
</decision_policy>

<tool_policy>
When to use tools, when not to use them, and any ordering constraints.
</tool_policy>

<output_contract>
Exact final schema or required sections.
</output_contract>

<examples>
Only when they clarify edge cases or output shape.
</examples>

<request_context>
Dynamic request-specific data.
</request_context>
```

## Examples and Reasoning Guidance

Use examples when they teach:

- edge cases
- ranking criteria
- abstain behavior
- exact output format

Do not bury the actual policy inside a pile of examples.
Do not assume "more clever prompt wording" beats missing retrieval, bad tools, or weak thresholds.
Benchmark explicit reasoning scaffolds on the target model instead of treating them as universal wins.

## Review Checklist

- Is the reusable prefix stable enough for caching?
- Are static instructions, tools, schemas, and examples ahead of dynamic content?
- Are policy, context, and untrusted input clearly separated?
- Is the decision policy explicit about priorities, abstain rules, and escalation?
- Would a smaller prompt plus better retrieval or tooling outperform a larger prompt?

## Sources

- OpenAI, "Prompt caching": https://developers.openai.com/api/docs/guides/prompt-caching
- OpenAI, "Prompt engineering": https://developers.openai.com/api/docs/guides/prompt-engineering
- Anthropic, "Prompting best practices": https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview
- Anthropic, "Use XML tags": https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags
- Google, "Context caching": https://ai.google.dev/gemini-api/docs/caching
