# Peated Classifiers

Use this when the work touches the Bottle or Entity classifier. The docs below
own the rules; this file lists what to read and what reviews usually check.

## Bottle Classifier

Start with [packages/bottle-classifier/AGENTS.md](../../../packages/bottle-classifier/AGENTS.md).
It lists the required reading, commands, and package boundaries. The main rules
are in [bottle-classifier.md](../../../docs/architecture/bottle-classifier.md).

Code to read, by question:

| Question                              | Read                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------- |
| What goes in and comes out            | `packages/bottle-classifier/src/contract.ts`, `src/classifierTypes.ts` |
| How the agent runs, tools, and limits | `src/classifierRuntime.ts`, `src/tools/`                               |
| What the model is told                | `src/instructions.ts`, `src/extractorInstructions.ts`                  |
| What code checks after the model      | `src/reviewPolicy.ts`, `src/fieldConflicts.ts`                         |
| How `auto` or `review` is chosen      | `src/automationTier.ts` (`deriveAutomationTier`)                       |
| How the server calls it and saves it  | `apps/server/src/agents/bottleClassifier/`                             |
| How price matching uses it            | `apps/server/src/lib/priceMatchingProposals.ts`                        |
| Model checks                          | `src/eval-fixtures/`, `*.eval.test.ts`, `.vitest-evals/AGENTS.md`      |

There are three entry points with separate contracts:

- extraction reads facts and never decides identity;
- classification returns `match`, `create_bottle`, or `no_match`;
- `auditBottle` returns Suggested Changes and findings that always need
  moderator approval.

A reference result never carries a Suggested Change. Keep the three apart.

Check:

- the model may match only a candidate retrieved in that run;
- local search comes before web search;
- extraction leaves a field `null` or `[]` rather than guessing;
- `identityScope` separates `product` from `exact_cask`;
- no numeric confidence: any `unresolvedRisks` entry forces review, and
  `deriveAutomationTier` sets the tier from action risk, evidence, and verified
  anchors;
- a typed field conflict adds a risk and sends a Match to review. It never
  turns a Match into No Match;
- exact stored references and verified codes such as SMWS are input anchors,
  not a way around the agent;
- post-model code may reject or send to review, but never upgrades a decision
  or requires agreement from name, rank, or brand-prefix rules;
- web tools are read-only, and when they are unavailable nothing substitutes
  another model or provider;
- instructions stay static; request data arrives through input and tools.

## Entity Classifier

Read [entity-classifier.md](../../../docs/architecture/entity-classifier.md),
then `packages/entity-classifier/src/` (`contract.ts`, `classifierRuntime.ts`,
`classifierTypes.ts`, `instructions.ts`, `reviewPolicy.ts`) and
`apps/server/src/agents/entityClassifier/service.ts`.

Check:

- queue discovery finds suspect Entities; it does not decide the fix;
- one Entity per run;
- local Entity search comes before web search;
- advice never picks Bottle IDs or fields to change;
- metadata advice needs authoritative support;
- advice tells Brand apart from distillery, owner, bottler, importer, and
  product or category wording;
- names such as `fullName` are weak evidence.

## Model Checks

Follow [model-checks.md](../../../docs/development/model-checks.md). Live runs
are slow and cost money: run the focused check for the change, not the full
set, unless you are comparing two classifier versions. Add the `trigger-evals`
label to run them in a pull request.
