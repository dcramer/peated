# Provider-Specific Templates

Use this reference when the user wants a prompt or agent design tailored to a specific runtime instead of a provider-neutral skeleton.

## Contents

- OpenAI Responses-style agents
- Anthropic tool-use agents
- Provider-specific review checks

Read `prompt-and-caching.md`, `system-prompt-templates.md`, and `tool-and-schema-design.md` first. Use this file only when you need the runtime-specific request shape.

## OpenAI Responses-Style Agents

Use this pattern when the agent is built around `responses.create`.

### Request Skeleton

```json
{
  "model": "gpt-5",
  "instructions": "<mission>\nYou resolve support tickets.\n</mission>\n\n<success_criteria>\n- Choose the correct next action.\n- Prefer tool-grounded evidence over unsupported assumptions.\n- If evidence is insufficient, return `needs_info`.\n</success_criteria>\n\n<decision_policy>\n- Prioritize account state, recent activity, and policy rules in that order.\n- Escalate if policy conflict is detected.\n</decision_policy>\n\n<tool_policy>\n- Use `get_account` before any mutating tool when account state is unclear.\n- Do not call mutating tools until the action is fully justified.\n</tool_policy>",
  "tools": [
    {
      "type": "function",
      "name": "get_account",
      "description": "Fetch account state needed to decide the next action. Use this before mutating tools when account state is unclear.",
      "strict": true,
      "parameters": {
        "type": "object",
        "properties": {
          "account_id": {
            "type": "string",
            "description": "Canonical account identifier."
          }
        },
        "required": ["account_id"],
        "additionalProperties": false
      }
    }
  ],
  "tool_choice": "auto",
  "parallel_tool_calls": false,
  "text": {
    "format": {
      "type": "json_schema",
      "name": "ticket_decision",
      "schema": {
        "type": "object",
        "properties": {
          "action": {
            "type": "string",
            "enum": ["reply", "refund", "escalate", "needs_info"]
          },
          "rationale": {
            "type": "string"
          }
        },
        "required": ["action", "rationale"],
        "additionalProperties": false
      }
    }
  },
  "input": [
    {
      "role": "user",
      "content": [
        {
          "type": "input_text",
          "text": "<request_context>{REQUEST_CONTEXT}</request_context>\n<user_input>{USER_INPUT}</user_input>"
        }
      ]
    }
  ]
}
```

### OpenAI-Specific Review Checks

- Is stable policy in `instructions` instead of being reassembled into the user message?
- Are `tools`, schemas, and examples kept identical across similar requests when caching matters?
- Is `text.format` used when the final result must be machine-checked?
- Is `parallel_tool_calls` disabled when side effects or tool dependencies require serialization?
- If many requests share long prefixes, would `prompt_cache_key` improve routing consistency?

## Anthropic Tool-Use Agents

Use this pattern when the agent is built around `messages.create`.

### Request Skeleton

```json
{
  "model": "claude-sonnet-4-5",
  "max_tokens": 1024,
  "tools": [
    {
      "name": "get_account",
      "description": "Fetch account state needed to decide the next action. Use this before any mutating action when account state is unclear. Do not use it to issue refunds or change account state.",
      "input_schema": {
        "type": "object",
        "properties": {
          "account_id": {
            "type": "string",
            "description": "Canonical account identifier."
          }
        },
        "required": ["account_id"]
      }
    }
  ],
  "system": [
    {
      "type": "text",
      "text": "<mission>You resolve support tickets and choose the correct next action.</mission>\n<success_criteria>\n- Prefer tool-grounded evidence over unsupported assumptions.\n- If evidence is insufficient, ask for clarification or escalate.\n</success_criteria>\n<decision_policy>\n- Prioritize account state, recent activity, and policy rules in that order.\n- Never approve a refund before eligibility is verified.\n</decision_policy>\n<tool_policy>\n- Use tools when current evidence is insufficient.\n- Avoid mutating actions until the decision is fully justified.\n</tool_policy>",
      "cache_control": { "type": "ephemeral" }
    }
  ],
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "<request_context>{REQUEST_CONTEXT}</request_context>\n<input>{USER_INPUT}</input>"
        }
      ]
    }
  ]
}
```

### Anthropic-Specific Review Checks

- Is reusable policy in top-level `system` instead of mixed into user messages?
- Are XML tags used consistently for instructions, context, examples, and variable input?
- Are `tools`, `system`, and reusable examples placed before dynamic messages when caching matters?
- If prompt caching is used, is `cache_control` placed at the end of the reusable prefix?
- Is `disable_parallel_tool_use` set when exactly one tool call must be enforced?
- After a `tool_use` block, is the tool result returned in a follow-up `user` message with the matching `tool_use_id`?

## Provider-Specific Differences That Matter

| Concern | OpenAI Responses | Anthropic Messages |
| --- | --- | --- |
| Stable policy channel | `instructions` | `system` |
| Dynamic request content | `input` | `messages` |
| Structured final output | `text.format` with JSON schema | Usually prompt + post-parse or tool/result structure |
| Tool definitions | `tools` with function schemas and `strict` | `tools` with `description` and `input_schema` |
| Tool-call control | `tool_choice`, `parallel_tool_calls` | `tool_choice`, `disable_parallel_tool_use` |
| Caching | automatic exact-prefix matching | explicit `cache_control` breakpoints |

## Sources

- OpenAI Responses API reference: https://platform.openai.com/docs/api-reference/responses/list
- OpenAI, "Prompt caching": https://developers.openai.com/api/docs/guides/prompt-caching
- OpenAI, "Function calling": https://developers.openai.com/api/docs/guides/function-calling
- OpenAI, "Structured model outputs": https://developers.openai.com/api/docs/guides/structured-outputs
- Anthropic, "Implement tool use": https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use
- Anthropic, "Prompting best practices": https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- Anthropic, "Prompt caching": https://platform.claude.com/docs/en/build-with-claude/prompt-caching
