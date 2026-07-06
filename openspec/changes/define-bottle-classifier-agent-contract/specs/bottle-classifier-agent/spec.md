## ADDED Requirements

### Requirement: Agent resolves observed identity before catalog outcome

The bottle classifier agent SHALL first determine the observed bottle, release, exact-cask, or unresolved identity represented by the input before deciding whether Peated should match, create, repair, or return no match.

#### Scenario: Clear source identity missing from Peated

- **WHEN** the input evidence identifies a real bottle or release and local candidates do not contain that exact target
- **THEN** the agent SHALL return a supported create action instead of treating missing local catalog state as unresolved identity

#### Scenario: Local candidate is nearby but not exact

- **WHEN** local candidates are related to the observed reference but add unsupported release, age, year, cask, barrel, bottler, or edition traits
- **THEN** the agent SHALL NOT match the over-specific candidate unless evidence supports those extra traits

#### Scenario: Observed identity remains ambiguous

- **WHEN** source, image, local, and web evidence do not identify a safe bottle or release target
- **THEN** the agent SHALL return `no_match` rather than inventing a hybrid identity

### Requirement: Raw source facts remain evidence

The classifier SHALL treat names, retailer titles, review titles, image text, URLs, source snippets, and extracted fields as evidence to interpret, not as canonical Peated identity by default.

#### Scenario: Retailer title contains generic style words

- **WHEN** a retailer title includes category, package, SEO, store, price, shipping, tasting-note, or condition wording that is not part of the marketed bottle identity
- **THEN** the agent SHALL exclude that wording from canonical bottle and release drafts

#### Scenario: Source fact is exact but not shared canon

- **WHEN** a cask number, barrel number, bottle number, outturn, market, store-exclusive phrase, or similar exact source fact is useful evidence but not proven reusable catalog identity
- **THEN** the agent SHALL preserve it as observation evidence instead of forcing a bottle or release split

### Requirement: Bottle precision layers are distinct

The classifier SHALL separate stable parent bottle identity, reusable child release identity, exact-cask bottle identity, and observation-only facts.

#### Scenario: Stable parent with reusable release trait

- **WHEN** evidence shows a stable parent expression and a reusable differentiator such as batch, edition, annual release, vintage, release year, or release-specific ABV
- **THEN** the agent SHALL use a release action or proposed release fields instead of placing the differentiator only in the parent bottle name

#### Scenario: Single known marketed form

- **WHEN** evidence identifies a specific marketed form and does not establish a reusable parent plus sibling release structure
- **THEN** the agent MAY keep the identifying trait at the bottle layer when that is the safer catalog identity

#### Scenario: Exact-cask identity

- **WHEN** the exact cask or code is itself the marketed bottle identity
- **THEN** the agent SHALL use `identityScope = exact_cask` and SHALL NOT create a child release for that exact-cask identity

### Requirement: Proposed bottle names use common label identity

For create or repair actions, `proposedBottle.name` SHALL be the common bottle label identity a user would recognize, not a maximal concatenation of every observed fact.

#### Scenario: Bottle-level age is stable identity

- **WHEN** an age statement is part of the common label identity for the bottle family
- **THEN** the agent SHALL include that age in the proposed bottle identity rather than hiding it only in structured metadata

#### Scenario: Release trait belongs below parent

- **WHEN** a batch, edition, year, ABV, or release code is reusable child release identity under a stable parent
- **THEN** the agent SHALL place that trait in `proposedRelease` and not duplicate it unnecessarily in `proposedBottle.name`

#### Scenario: Observation trait is too exact

- **WHEN** an exact barrel, cask, bottle number, outturn, or retailer-exclusive fact is not proven shared catalog identity
- **THEN** the agent SHALL NOT include that fact in the common parent bottle name solely because it appears in source text

### Requirement: Local candidates are evidence not commands

The classifier SHALL use local candidates to determine whether Peated already contains the observed identity and how nearby identities are modeled, but SHALL NOT let local ranking, fuzzy similarity, prefix overlap, or candidate presence override stronger observed evidence.

#### Scenario: Candidate field semantics are available

- **WHEN** local candidates are provided to the agent
- **THEN** the instructions SHALL explain that `kind = bottle` means parent bottle, `kind = release` means child release, `fullName` is the candidate display string, `bottleFullName` is the parent display string for release candidates, `releaseId` identifies the child release, and `familyContext` describes nearby sibling or legacy parent structure

#### Scenario: Every input envelope field has semantics

- **WHEN** the runtime serializes a field into the agent input envelope, such as `hasExactAliasMatch`, `candidateExpansion`, `investigationHint`, `currentBottle`, or preloaded `webEvidence`
- **THEN** the instructions SHALL explain what that field means and how it should influence the decision, or the field SHALL be removed from the envelope

#### Scenario: Terminology is consistent

- **WHEN** the instructions, tool schemas, output schema, and input envelope refer to the same concept
- **THEN** they SHALL use one term defined once in the bottle identity model section, matching the schema field name where one exists, and SHALL NOT introduce undefined prompt-only synonyms or jargon

#### Scenario: Upstream extraction shares the definitions

- **WHEN** an upstream contract such as label extraction produces fields that flow into the classifier input envelope, for example `expression`, `series`, or `edition`
- **THEN** that contract SHALL define those fields with the same meaning the classifier input map gives them, so a field cannot mean one identity layer to the extractor and another to the classifier

#### Scenario: Existing release candidate matches exact identity

- **WHEN** a release candidate covers the observed parent bottle and release traits without unsupported extras
- **THEN** the agent SHALL return `match` with both `matchedBottleId` and `matchedReleaseId`

#### Scenario: Existing parent covers bottle only

- **WHEN** a parent bottle candidate covers the observed stable bottle identity but the observed release traits are unsupported or not reusable
- **THEN** the agent SHALL match the parent bottle and preserve unsupported exact facts as observations when appropriate

### Requirement: Web and source evidence support identity decisions

The classifier SHALL use web, source-page, image, local, and deterministic evidence according to the uncertainty and action risk of the decision.

#### Scenario: Create or repair needs support

- **WHEN** the agent proposes creating canonical identity or repairing existing canonical identity
- **THEN** the decision SHALL identify concrete supporting evidence from source, image, local family context, web results, or a closed-form deterministic anchor

#### Scenario: Clear existing match does not need web search

- **WHEN** local candidate evidence and observed source or image evidence are sufficient to safely match an existing bottle or release
- **THEN** the agent MAY return `confidenceBasis.webEvidence = not_needed`

#### Scenario: Web evidence conflicts

- **WHEN** web or source evidence conflicts with the observed input or selected local target on a material identity trait
- **THEN** the agent SHALL lower confidence, record unresolved risk, choose a safer action, or return `no_match`

### Requirement: Alias safety is separate from identity scope

The classifier SHALL distinguish the Peated identity being matched or created from whether the observed source label is safe as a reusable global alias.

#### Scenario: Exact source item has generic title

- **WHEN** source-specific evidence identifies an exact existing bottle or release but the submitted title is generic or reusable for multiple possible bottles
- **THEN** the agent SHALL be able to return a match while setting `aliasScope = none`

#### Scenario: Label is globally reusable

- **WHEN** the observed label is specific enough to be safely reused as a future assignment alias for the same Peated target
- **THEN** the agent MAY set `aliasScope = global_alias`

#### Scenario: Alias safety is missing

- **WHEN** an agent decision omits alias-safety metadata in a flow that can write aliases
- **THEN** downstream automation SHALL treat the decision conservatively and SHALL NOT create a reusable global alias by default

#### Scenario: Alias scope is enforced at write time

- **WHEN** automation creates a reusable alias from a classified listing title
- **THEN** the alias-writing code SHALL read the asserted alias scope and SHALL NOT store the title as a reusable global alias unless `global_alias` was asserted; an asserted scope with no enforcing consumer is a contract violation

### Requirement: Output basis fields explain the decision

The classifier SHALL return structured basis fields that explain identity placement, evidence, and unresolved risk without relying on freeform rationale or a numeric confidence score.

#### Scenario: Identity basis is present

- **WHEN** the agent returns a reviewed match, create, repair, or no-match decision
- **THEN** the decision SHALL include `identityBasis` or an equivalent structured basis identifying bottle traits, release traits, observation traits, year interpretation, and sibling evidence, with all uncertainty expressed in the single typed risk list rather than a second freeform uncertainty field

#### Scenario: Confidence basis is present

- **WHEN** the agent returns a reviewed decision
- **THEN** the decision SHALL include `confidenceBasis` or an equivalent structured basis identifying positive evidence, unresolved risks, tools used, and web-evidence status, with each unresolved risk carrying a typed category and a freeform note

#### Scenario: Evidence precedes the action in the output schema

- **WHEN** the agent output schema is defined
- **THEN** structured basis and rationale fields SHALL be ordered before the action, target ids, and proposed drafts so the model asserts evidence before committing to the decision

#### Scenario: Every output field has agent-facing semantics

- **WHEN** a field exists on the agent-facing output schema
- **THEN** its semantics SHALL be stated in the prompt's output contract section or as a description on that agent-facing schema, not only on internal validation schemas the model never sees

### Requirement: Automation gating is derived by code from evidence

Numeric `confidence` SHALL NOT be part of the agent output contract. Consumer code SHALL derive any automation tier from the action's risk class and the structured evidence the agent asserts.

#### Scenario: User-driven flow needs no gate

- **WHEN** the classifier runs inside a user-confirmed flow such as Add Bottle
- **THEN** the consumer MAY act on the decision directly without an automation tier because the user confirms the outcome

#### Scenario: Automated flow derives the tier

- **WHEN** an automated flow such as price scraping consumes a decision
- **THEN** the consumer SHALL derive automatic-action eligibility in code from the action's risk class, `unresolvedRisks`, `webEvidence`, exact-alias or current-assignment anchors, and deterministic anchors, and SHALL route the decision to review when there is no clear match, supported create, or anchored repair

#### Scenario: Model veto forces review

- **WHEN** the agent asserts any unresolved risk, including a holistic concern expressed through an uncategorizable-risk category
- **THEN** automation SHALL route the decision to review, and no agent-asserted field SHALL upgrade a decision the derived tier routes to review

#### Scenario: No self-scored confidence in the contract

- **WHEN** the agent output schema is defined
- **THEN** it SHALL NOT include a numeric confidence score or a self-asserted confidence band; the agent expresses certainty only through evidence, risks, and the action itself

### Requirement: Agent components must earn their place

Every input envelope field, tool, output field, and runtime stage in the classifier SHALL have an identifiable consumer or a measured effect on decision quality; components with neither SHALL be removed rather than documented.

#### Scenario: Output field has no consumer

- **WHEN** an output field is consumed by no downstream code, review surface, or eval scorer
- **THEN** it SHALL be removed from the agent contract instead of being carried as unread weight the model must still fill

#### Scenario: Input or tool shows no decision value

- **WHEN** telemetry or eval ablation shows an input field or tool does not change decisions or is never used
- **THEN** it SHALL be removed or narrowed, and the token budget reclaimed, rather than retained by default

#### Scenario: Runtime stage is unproven

- **WHEN** a runtime stage such as a retry pass or evidence preload lacks measured benefit
- **THEN** its value SHALL be established with an eval comparison before it is extended, and it MAY be removed if the comparison shows no benefit

### Requirement: Basis fields evolve toward machine-checkable structure

Because code derives gating from the basis fields, revisions to basis-field schemas SHALL prefer typed, verifiable structure over freeform strings, landing each revision only when evals show the structure is reliable.

#### Scenario: Evidence claims are verifiable

- **WHEN** the schema for `positiveEvidence` is revised
- **THEN** each evidence entry SHOULD name its source kind and locator (source label, image, local candidate id, or web result URL) so validation can confirm the citation exists in the collected run artifacts and reject fabricated evidence

#### Scenario: Trait placement is structured

- **WHEN** the schema for `identityBasis` is revised
- **THEN** bottle, release, and observation trait placement SHOULD be expressed as typed trait fields with values rather than freeform strings, so evals and review policy can check placement mechanically

#### Scenario: Schema changes are eval-gated

- **WHEN** any output schema attribute is added, retyped, reordered, or removed
- **THEN** the change SHALL re-record replay recordings and compare focused eval results before and after

### Requirement: Prompt instructions follow the agent contract

The classifier prompt SHALL be organized so the model can identify the task, understand the input components, apply the bottle model, evaluate evidence, choose an action, and satisfy the output schema without relying on scattered or contradictory prose.

#### Scenario: Prompt section order

- **WHEN** classifier instructions are built
- **THEN** they SHALL present stable sections for task and success criteria, input map, bottle identity model, evidence policy and tool use, decision workflow, action semantics, and output contract, and MAY end with short examples or edge-case notes

#### Scenario: Low-prose prompt cleanup

- **WHEN** a rule can be stated once in the section that owns it
- **THEN** the prompt SHALL avoid repeating the same rule in other sections unless the repetition clarifies a distinct output consequence

#### Scenario: Precedence lives in the workflow order

- **WHEN** two rules would need override or precedence language such as "this rule overrides" or "however" to coexist
- **THEN** they SHALL be folded into the ordered decision workflow so that step order expresses the precedence, instead of remaining as competing rules

#### Scenario: Examples do not override policy

- **WHEN** examples or edge-case notes are included
- **THEN** they SHALL be a small set of hand-authored diverse canonical cases per action, SHALL NOT reuse the concrete bottles of eval fixtures, and SHALL illustrate the contract without becoming bottle-specific exceptions that contradict the general rules

#### Scenario: Instructions are static per mode

- **WHEN** classifier instructions are built for an instruction mode
- **THEN** the instructions SHALL be static for that mode, with runtime facts carried by the input envelope, tool schemas, and post-model validation rather than dynamically branched instruction text

#### Scenario: Envelope carries facts, not instructions

- **WHEN** the runtime needs to influence agent behavior for a specific run, such as a retry after a `no_match` pass or preloaded web evidence
- **THEN** it SHALL pass structured facts in the envelope whose semantics the static input map explains, and SHALL NOT inject freeform directive prose through envelope fields

#### Scenario: Instructions match the tool surface

- **WHEN** an instruction mode runs with a restricted tool surface, such as classification without candidate expansion
- **THEN** the instructions or input map SHALL define how the model behaves without the missing tools, and SHALL NOT direct the model to call tools that are not attached

### Requirement: Prompt and fixture changes are eval-validated

Changes to classifier instructions, output semantics, or eval expectations SHALL be validated with fixture checks and focused classifier evals before being accepted.

#### Scenario: Prompt behavior changes

- **WHEN** classifier prompt wording changes in a way that can affect decisions
- **THEN** fixture validation and focused classifier evals SHALL run for the touched behavior

#### Scenario: Baseline precedes cleanup

- **WHEN** a prompt reorganization or consolidation effort begins
- **THEN** a full classifier eval baseline SHALL be recorded first, and each subsequent slice SHALL be compared against it with results broken down by action

#### Scenario: Abstention is measured in both directions

- **WHEN** eval results are summarized
- **THEN** the summary SHALL distinguish missed matches (false `no_match`) from false positives, so prompt changes cannot trade one for the other invisibly

#### Scenario: Production miss fixture

- **WHEN** an eval fixture is based on a production miss
- **THEN** the fixture SHALL preserve the observed reference, source or image evidence, local candidates when available, verified source URLs, and exact expected Peated DB outcome

#### Scenario: Fixture expectation is suspected wrong

- **WHEN** eval results suggest an expected output may be wrong
- **THEN** the expected output SHALL be changed only after verifying the real bottle or release and the correct Peated catalog outcome

#### Scenario: Avoid overfitting one case

- **WHEN** a prompt or schema change is motivated by one eval fixture
- **THEN** validation SHALL include a generalized or distinct case where practical so the change is not only tuned to that fixture's exact bottle details
