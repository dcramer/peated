# Review Policy Boundary Audit

This audit classifies the transforms in `reviewPolicy.ts`. The boundary comes
from the Review Policy Audit section in `docs/architecture/bottle-classifier.md`.

Use these classes:

- **Schema validation** checks the output shape and required action fields.
- **Closed-form gate** checks known ids, direct field conflicts, or a closed
  identifier.
- **Second-classifier drift** interprets Bottle meaning after the agent returns
  a valid decision.

## Current transforms

| Transform                                                                                                         | Class                   | Result                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parse `BottleClassifierAgentDecisionSchema` and `BottleClassificationDecisionSchema`                              | Schema validation       | Keep.                                                                                                                                                 |
| Require a target id for `match` and a Bottle draft for `create_bottle`                                            | Schema validation       | Keep. An incomplete action is an impossible state.                                                                                                    |
| Remove candidate ids that the classifier did not review and reject an unknown matched Bottle id                   | Closed-form gate        | Keep. The runtime owns the reviewed id set.                                                                                                           |
| Normalize observations, ABV values, and the flat Bottle draft                                                     | Schema validation       | Keep. These transforms do not choose a different Bottle.                                                                                              |
| Clear an Entity id when its resolved type or exact resolved name is invalid                                       | Closed-form gate        | Keep. The runtime owns known Entity ids and types.                                                                                                    |
| Reject a matched Bottle when populated extracted fields directly conflict with populated candidate fields         | Closed-form gate        | Keep. Missing fields do not create a conflict.                                                                                                        |
| Resolve and validate SMWS exact-cask codes                                                                        | Closed-form gate        | Keep. SMWS codes are the documented closed identifier exception.                                                                                      |
| Reject exact-cask creation when the same reviewed candidate has the same exact code and no direct field conflict  | Closed-form gate        | Keep. The code anchor, not a fuzzy name score, proves the collision.                                                                                  |
| Infer or rewrite `identityScope` from general cask-number and name patterns                                       | Second-classifier drift | Narrow in a later slice. Code must not promote product scope from semantic text patterns. Keep only explicit scope validation and the SMWS exception. |
| Rewrite Bottle names to restore age text or remove exact traits                                                   | Second-classifier drift | Remove or narrow in later eval-backed slices. The agent owns common marketed Bottle identity and field placement.                                     |
| Reject a Bottle draft because its normalized name duplicates the Brand or becomes empty after exact-trait removal | Second-classifier drift | Narrow in a later slice to schema-level empty-name validation. Do not infer the correct expression in code.                                           |
| Reject `create_bottle` when token counts say that the proposal expanded beyond a sparse reference                 | Second-classifier drift | Remove in a later eval-backed slice. Source interpretation belongs to the agent.                                                                      |
| Reject `create_bottle` when normalized or possessive-insensitive candidate names look like the proposed Bottle    | Second-classifier drift | Removed in this slice. The comparison could hide a valid create when the candidate had an unsupported release trait.                                  |
| Reject obvious non-whisky, multi-item, packaging-only, or damaged-sale references before classification           | Closed-form gate        | Keep. This is the documented non-whisky and impossible-input boundary.                                                                                |

## Removal order

1. Remove the generic duplicate-create name classifier. This slice completes
   that removal and keeps the exact-cask code collision gate.
2. Remove the sparse-reference token gate.
3. Stop rewriting and rejecting common Bottle identity from age and exact-trait
   name patterns.
4. Narrow identity-scope checks to explicit structured facts and the SMWS code
   exception.

Each behavior change needs focused deterministic tests. Run the matching live
eval slice before removing the next semantic gate. If the agent result is wrong,
fix the agent contract or evidence path. Do not restore a second classifier in
the review boundary.
