import { expect } from "vitest";
import { createHarness, describeEval } from "vitest-evals";
import {
  createEvalDecisionModel,
  hasEvalAIGatewayCredentials,
} from "./evalSupport";
import { getScopePrecheckIgnoreReason } from "./scopePrecheck";
import {
  SCOPE_PRECHECK_EVAL_CASES,
  type ScopePrecheckEvalCase,
} from "./scopePrecheck.eval.fixtures";

const scopePrecheckHarness = createHarness<
  ScopePrecheckEvalCase,
  string | null
>({
  name: "scope-precheck",
  run: async ({ input }) => {
    const output = await getScopePrecheckIgnoreReason({
      model: createEvalDecisionModel(),
      title: input.title,
    });
    return {
      output,
      events: [
        { type: "message", role: "user", content: input.title },
        { type: "message", role: "assistant", content: output },
      ],
    };
  },
});

describeEval(
  "scope pre-check evals",
  {
    skipIf: () => !hasEvalAIGatewayCredentials,
    harness: scopePrecheckHarness,
  },
  (it) => {
    it.for(SCOPE_PRECHECK_EVAL_CASES)(
      "$source: $name",
      async (testCase, { run }) => {
        const { output } = await run(testCase);
        // A wrong ignore drops a real Bottle without review, so a keep case
        // must reach the agent.
        if (testCase.expected === "keep") expect(output).toBeNull();
        else expect(output).not.toBeNull();
      },
    );
  },
);
