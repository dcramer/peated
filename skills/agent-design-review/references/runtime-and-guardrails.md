# Runtime and Guardrails

Use this reference when reviewing loops, retries, approvals, trust boundaries, or side effects.

## Loop Design

Make the runtime policy explicit:

- what starts a run
- what evidence can trigger another turn
- what ends the run
- how many turns are allowed
- what counts as no progress
- which failures are retried versus escalated
- when a human must review the result

Agents should stay grounded in environment feedback. If the system cannot validate progress from tools or state, tighten the loop or reduce autonomy.

## Trust Boundaries

Keep untrusted content out of privileged instruction channels.
Treat retrieved content, tool outputs, and user input as data, not policy.
Enforce permissions, approvals, and side-effect boundaries in code, not just in prompt text.
Use least-privilege tool access where the runtime allows it.

## High-Risk Automation

When the system can take actions with material impact:

- require evidence before action
- gate automation with thresholds or policy rules
- require explicit approval for destructive or high-stakes actions
- verify the result after action
- log enough trace data for review

Bias the runtime against costly false positives.

## Review Questions

- Are stop conditions explicit?
- Are retries bounded and justified by failure type?
- Is there a clear manual-review or escalation path?
- Are trust boundaries enforced outside the prompt?
- Are thresholds tied to real consequences?
- Can operators inspect traces to understand why the system acted?

## Sources

- Anthropic, "Building effective agents": https://www.anthropic.com/research/building-effective-agents/
- OpenAI, "Safety in building agents": https://developers.openai.com/api/docs/guides/agent-builder-safety
- OpenAI, "A practical guide to building agents": https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/
