# Tools And Schemas

Tools use `tool()` from `@openai/agents` with zod schemas.

## Tools

- One job per tool. Overlapping tools make the model pick wrong.
- Keep read tools apart from tools that propose changes.
- The description says when to use the tool, when not to, and what to try
  first.
- Return parsed data, not prose. `search_bottles` parses its results with
  `SearchBottlesResultSchema` before returning them.
- Return only what the decision needs. Follow
  [sensitive-data.md](../../../docs/policies/sensitive-data.md).
- Give the agent only the tools the current step needs.
- Turn off `parallelToolCalls` unless calls are independent.
- A proposal tool never writes. It rejects a proposal that cites no evidence or
  names a record the run never looked at.

Description from
[searchBottles.ts](../../../packages/bottle-classifier/src/tools/searchBottles.ts):

```text
Search local Peated Bottle candidates. Use before web search when local
matches are missing or conflicting, and again after web evidence reveals a
canonical trait that could recover a better local candidate.
```

## Inputs And Outputs

- Describe every field with `.describe()`, including when to leave it empty.
- Use `.nullable().default(null)`, not `.optional()`, and say whether `null`
  means unknown, not applicable, or none.
- Use enums for actions and statuses, and IDs for records. Avoid free text that
  code parses later.
- Never let model input set the user, owner, credentials, or permissions. Code
  passes those in outside the schema.
- Use typed evidence and risks, not a confidence score.
- Parse every model output with its schema, then check its IDs against what the
  run found.
- Remove fields no code reads.

Field from
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
