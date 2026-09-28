# Tools And Schemas

Use this when writing or changing a tool, its input, its result, or an agent's
output schema. Tools use `tool()` from `@openai/agents` with zod schemas.

## Tools

- One job per tool. Two tools that partly overlap confuse tool choice.
- Keep read tools apart from tools that propose or change anything.
- The description says when to use the tool and when not to. Order matters
  here: say what to try first.
- Return structured, parsed data, not prose. Parse results with a schema before
  returning them, as `search_bottles` does with `SearchBottlesResultSchema`.
- Keep results small and bounded. Return only what the decision needs, and
  follow [sensitive-data.md](../../../docs/policies/sensitive-data.md) for
  what may be included.
- Give the agent only the tools the current step needs.
- Disable `parallelToolCalls` unless calls are independent.
- A tool that proposes a change must reject a proposal without cited evidence
  or with an ID the run never inspected. It must never write.

Example from
[searchBottles.ts](../../../packages/bottle-classifier/src/tools/searchBottles.ts):

```text
Search local Peated Bottle candidates. Use before web search when local
matches are missing or conflicting, and again after web evidence reveals a
canonical trait that could recover a better local candidate.
```

## Inputs And Outputs

- Every field says what it means with `.describe()`, including when to leave
  it empty.
- Define what an empty value means. Prefer `.nullable().default(null)` over
  `.optional()`, and say in the description whether `null` means unknown,
  not applicable, or none.
- Use enums for actions and statuses, and IDs for records. Avoid free text that
  code later parses.
- Model input never supplies the user, owner, credentials, permissions, or
  other trusted state. Code passes those in, outside the schema.
- No confidence score. Use typed evidence and typed risks that code can act on.
- Validate every model output with the schema before use, then check IDs
  against what the run actually retrieved.

Example from
[classifierTypes.ts](../../../packages/bottle-classifier/src/classifierTypes.ts):

```ts
bottler: z
  .string()
  .trim()
  .nullable()
  .default(null)
  .describe(
    "Business that independently selects and releases whisky made by another producer. It may also be the brand. Leave null for an official Brand or distillery release, or when product evidence does not establish the role.",
  ),
```

## Review Questions

- Can the model pick the wrong tool because two tools overlap?
- Does any tool return prose the model has to reread?
- Can a model-controlled field change who owns or may change something?
- Does every nullable field say what `null` means?
- Is a field unused by code? Remove it.
