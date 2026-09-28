# Prompts

## Where Each Rule Goes

From [agent-design.md](../../../docs/policies/agent-design.md):

| Rule                              | Place                     |
| --------------------------------- | ------------------------- |
| How to decide                     | Instructions              |
| What a field means                | Schema `.describe()` text |
| When to call a tool, and when not | Tool description          |
| Who may do what                   | Code                      |

Move a misplaced rule before adding words.

## Layout

Keep instructions, tools, and schemas the same on every run, and put request
data after them. OpenAI reuses cached work only when the start of a request
matches an earlier one.

Outline, leaving out empty sections:

```text
<goal>What the agent decides and returns.</goal>

<decision_rules>
What to compare first. Which differences decide the answer. What is weak
evidence. When to return no_match or send to review.
</decision_rules>

<tool_rules>
Which tool to try first. When not to call a tool. Search budget.
</tool_rules>

<examples>Only for edge cases the rules cannot state.</examples>
```

## Rules

- Use the same terms as the schema, tools, and
  [glossary](../../../docs/architecture/bottle-classifier-glossary.md).
- Name the safe result (`no_match`, review) and when to use it.
- Never copy test case names, inputs, expected answers, or distinctive phrases
  into a prompt. Write the general rule.
- Keep listing text, web pages, and user input out of the instructions.
