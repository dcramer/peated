# Peated Classifiers

## Bottle Classifier

Start with [packages/bottle-classifier/AGENTS.md](../../../packages/bottle-classifier/AGENTS.md)
for required reading, commands, and package boundaries. The rules are in
[bottle-classifier.md](../../../docs/architecture/bottle-classifier.md).

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

Keep the three entry points apart:

- extraction reads facts and never decides identity;
- classification returns `match`, `create_bottle`, or `no_match`, never a
  Suggested Change;
- `auditBottle` returns Suggested Changes and findings, which always need
  moderator approval.

Check:

- the model matches only a candidate found in that run;
- local search comes before web search;
- extraction leaves a field `null` or `[]` rather than guessing;
- `identityScope` separates `product` from `exact_cask`;
- any `unresolvedRisks` entry forces review, and `deriveAutomationTier` sets the
  tier from the action, evidence, and verified facts;
- a conflicting typed field sends a Match to review. It never turns it into No
  Match;
- exact stored references and verified codes such as SMWS are starting facts
  for the agent, not a way to skip it;
- code never upgrades a decision or requires agreement from name, rank, or
  brand-prefix rules;
- web tools only read, and nothing replaces them when they are down.

## Entity Classifier

Read [entity-classifier.md](../../../docs/architecture/entity-classifier.md),
then `packages/entity-classifier/src/` (`contract.ts`, `classifierRuntime.ts`,
`classifierTypes.ts`, `instructions.ts`, `reviewPolicy.ts`) and
`apps/server/src/agents/entityClassifier/service.ts`.

Check:

- the review queue finds suspect Entities; it does not decide the fix;
- one Entity per run;
- local Entity search comes before web search;
- advice never picks Bottle IDs or fields to change;
- metadata advice needs an authoritative source;
- advice tells a Brand apart from a distillery, owner, bottler, importer, or
  product or category wording;
- names such as `fullName` are weak evidence.

## Model Checks

Live runs are slow and cost money. Run the check for your change, not the full
set, unless you are comparing two classifier versions. Add the `trigger-evals`
label to run them on a pull request.
