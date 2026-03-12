# Tool Schema Examples

Use this reference when the task is to design, rewrite, or critique actual tool schemas.

## Contents

- Bad vs good examples
- Copy-paste schema patterns

Read `tool-and-schema-design.md` first for the rules. Use this file only when you need concrete schema drafts or rewrites.

## Bad vs Good: Search Tool

Weak schema:

```json
{
  "name": "search",
  "description": "Search for something",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string"
      }
    },
    "required": ["query"]
  }
}
```

Why it is weak:

- tool purpose is too broad
- no guidance on when not to use it
- no constraints on scope or source
- return shape is unspecified

Improved schema:

```json
{
  "name": "search_catalog",
  "description": "Search the local catalog for candidate matches. Use this when the current candidate set is thin, conflicting, or missing an obvious near match. Prefer this tool before broader web search because it is cheaper and returns structured candidates. Do not use it for category-only lookups or for mutating catalog state.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "The most specific query you can form from trusted input."
      },
      "limit": {
        "type": "integer",
        "description": "Maximum number of candidates to return.",
        "minimum": 1,
        "maximum": 20
      }
    },
    "required": ["query"]
  }
}
```

## Bad vs Good: Mutating Tool

Weak schema:

```json
{
  "name": "account_action",
  "description": "Do something to an account",
  "parameters": {
    "type": "object",
    "properties": {
      "user_input": {
        "type": "string"
      }
    },
    "required": ["user_input"]
  }
}
```

Why it is weak:

- hides multiple actions in one tool
- encourages freeform strings
- makes permissions and review hard to enforce

Improved approach:

Split the surface into read and write tools:

```json
{
  "name": "get_account",
  "description": "Retrieve account state needed to decide the next action. Use this before any mutating account action when state is unclear.",
  "parameters": {
    "type": "object",
    "properties": {
      "account_id": {
        "type": "string",
        "description": "The canonical account identifier."
      }
    },
    "required": ["account_id"]
  }
}
```

```json
{
  "name": "refund_order",
  "description": "Issue a refund for a single order after policy and eligibility have been verified. Do not use this tool to investigate eligibility or search for the order. This action has side effects and should only be called when refund conditions are already satisfied.",
  "parameters": {
    "type": "object",
    "properties": {
      "order_id": {
        "type": "string",
        "description": "The canonical order identifier."
      },
      "reason_code": {
        "type": "string",
        "enum": ["damaged", "fraud", "duplicate", "service_failure"],
        "description": "Policy-approved refund reason."
      }
    },
    "required": ["order_id", "reason_code"]
  }
}
```

## Copy-Paste Pattern: Retrieval Tool

```json
{
  "name": "[tool_name]",
  "description": "[What it retrieves]. Use this when [positive trigger]. Do not use it when [negative trigger]. Returns [structured result shape].",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "[query guidance]"
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 20,
        "description": "[limit guidance]"
      }
    },
    "required": ["query"]
  }
}
```

## Copy-Paste Pattern: Typed Final Output

Use a strict schema for final decisions when downstream code depends on the result.

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["match_existing", "create_new", "no_match", "escalate"]
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 100
    },
    "rationale": {
      "type": ["string", "null"]
    },
    "candidate_ids": {
      "type": "array",
      "items": {
        "type": "integer"
      }
    }
  },
  "required": ["action", "confidence", "rationale", "candidate_ids"],
  "additionalProperties": false
}
```

## Sources

- Anthropic, "Implement tool use": https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use
- OpenAI, "Function calling": https://developers.openai.com/api/docs/guides/function-calling
- OpenAI, "Structured Outputs": https://openai.com/index/introducing-structured-outputs-in-the-api/
- Google, "Function calling": https://ai.google.dev/gemini-api/docs/function-calling
- Google, "Structured output": https://ai.google.dev/gemini-api/docs/structured-output
