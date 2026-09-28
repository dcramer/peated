# Prompts

Use this when writing or changing agent instructions.

## Where Each Rule Goes

From [agent-design.md](../../../docs/policies/agent-design.md):

| Rule                              | Home                      |
| --------------------------------- | ------------------------- |
| How to decide                     | Instructions              |
| What a field means                | Schema `.describe()` text |
| When to call a tool, and when not | Tool description          |
| Who may do what                   | Code                      |

If a rule sits in the wrong place, move it before adding words.

## Layout

Keep instructions static. Put request data in the input, tools, and tool
results. OpenAI caches the longest identical prefix, so anything that changes
per request belongs after the stable part.

Order: instructions, tools, output schema, then request input. Tools and
schemas should not change between similar runs.

A useful outline, with sections left out when empty:

```text
<goal>What the agent decides and returns.</goal>

<decision_rules>
What to compare first. What differences are decisive. What is weak evidence.
When to return no_match or send to review.
</decision_rules>

<tool_rules>
Which tool to try first. When not to call a tool. Search budget.
</tool_rules>

<examples>Only for edge cases the rules cannot state clearly.</examples>
```

## Rules

- Say what to do, not only what to avoid.
- Use the same terms as the schema, tools, and
  [glossary](../../../docs/architecture/bottle-classifier-glossary.md).
- Name a safe result (`no_match`, review) and when to use it.
- Never copy test case names, inputs, expected answers, or distinctive phrases
  into a prompt. Write the general rule instead.
- Do not ask for a confidence number. Ask for typed evidence and risks.
- Keep listing text, web pages, and user input out of the instructions. They are
  data, not instructions.
- Before adding prompt text, check whether better candidates, a better tool
  result, or a schema description would fix the failure.
- Measure reasoning-effort or wording changes with model checks on the target
  model. Do not assume they help.
