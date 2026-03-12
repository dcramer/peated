# Eval Prompts

Use these prompts to check whether `agent-design-review` can improve both general agents and classifier-style agents.

## Prompt 1

Review our current bottle matching agent and identify the highest-leverage change to reduce false positive matches.

Pass if the review:

- defines a success contract
- maps the execution path end to end
- names a primary bottleneck
- does not stop at generic prompt advice
- proposes an eval that could measure improvement

## Prompt 2

Rewrite our system prompt so it is easier to cache and maintain without changing behavior.

Pass if the review:

- distinguishes stable prefix content from dynamic content
- returns a prompt skeleton rather than an unstructured blob
- keeps tools and schemas in the reusable prefix
- mentions how to verify behavior did not regress

## Prompt 3

Our agent has 18 tools and keeps choosing the wrong one. Review the design and suggest the smallest effective changes.

Pass if the review:

- inspects tool overlap and tool descriptions
- discusses tool-set reduction or per-step restriction
- prefers typed parameters and structured returns
- ties recommendations to observed failure modes

## Prompt 4

Write a system prompt for a tool-using agent that resolves support tickets and returns a typed action.

Pass if the result:

- returns a reusable prompt skeleton
- includes success criteria, decision policy, tool policy, and output contract
- keeps dynamic input in explicit slots
- includes an abstain or clarification path

## Prompt 5

Rewrite this tool schema so the model stops misusing it:

```json
{
  "name": "search",
  "description": "Search for something",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {"type": "string"}
    },
    "required": ["query"]
  }
}
```

Pass if the result:

- explains why the schema is weak
- narrows the tool purpose
- adds stronger descriptions and constraints
- preserves a realistic JSON-schema shape

## Prompt 6

We want to reduce `create_new` mistakes without exploding the moderator queue. Review the agent and suggest the smallest effective changes.

Pass if the review:

- discusses thresholds or automation gates
- distinguishes model behavior from post-model policy
- includes queue or operator-load effects in the eval plan

## Prompt 7

Should this customer-support workflow stay a single agent or split into router, retriever, and responder agents?

Pass if the review:

- starts from the success contract
- evaluates a simpler workflow before recommending more agents
- justifies any multi-agent split with a real bottleneck
- defines how the architecture choice would be tested

## Prompt 8

Write the provider-specific version of this prompt for an OpenAI Responses-style agent.

Pass if the result:

- uses `instructions` for stable policy
- puts dynamic content in `input`
- includes an appropriate `text.format` schema when the output is typed
- mentions tool and cache stability where relevant

## Prompt 9

Write the provider-specific version of this prompt for an Anthropic tool-use agent.

Pass if the result:

- uses top-level `system`
- uses XML tags or similarly explicit structure
- places reusable content before dynamic `messages`
- handles tool results and caching in an Anthropic-compatible way
