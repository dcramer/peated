# Bottle Classifier

The Bottle classifier turns a source name, page, or image into a reviewed Peated
Bottle decision. This document owns its lasting behavior and safety rules. The
[package README](../../packages/bottle-classifier/README.md) owns its API,
configuration, commands, and file map.

Use the terms in the
[Bottle Classifier Glossary](./bottle-classifier-glossary.md) in classifier
prompts, schemas, code, and technical documentation. Use everyday language in
customer text.

## Results

The package has three separate entry points:

- `extractBottleReferenceIdentity(...)` reads facts from text or an image. It
  does not decide Peated identity.
- `classifyBottleReference(...)` returns `match`, `create_bottle`, or
  `no_match`, or ignores input that is not one whisky Bottle.
- `auditBottle(...)` checks an existing Bottle and returns a summary, Suggested
  Changes (`ProposedOperation` in code), and findings. It does not return a
  second reference decision.

A reference result includes the facts that were extracted, candidates that were
reviewed, evidence that was gathered, and resolved Brand, bottler, and distillery
Entities. The model may match only a candidate that was retrieved for that run.

`no_match` is a safe result. Use it when identity remains unclear or a stored
conflict must be corrected before a reference can be assigned. Downstream code
must not assign a candidate that the classifier did not match.

Catalog correction is separate from reference resolution. A reference result
never includes a Suggested Change. An audit never changes which Bottle a
reference identifies.

## Bottle Identity

Follow the [Whisky Identity Model](./whisky-identity-model.md). Each marketed
version must be a complete Bottle on its own.

A `create_bottle` result proposes one complete Bottle. `proposedBottle.name` is
the stable marketed expression. The server adds an explicit edition without
repeating it and stores supported facts such as age, ABV, years, and cask flags
in their fields. The server creates the Bottle and manages BottleGroup
membership. The classifier never chooses a BottleGroup.

`identityScope = product` is the default. Use `exact_cask` only when a specific
cask is the marketed Bottle identity. Generic cask or barrel wording is not
enough.

Keep each fact at the product level supported by its evidence. For example, do
not give a blend a component's age, year, or strength. Keep a production lot,
bottle number, or retailer selector as an observation unless evidence shows
that it identifies the marketed Bottle.

`maturation` keeps the producer's wording. Do not split it into inferred cask
type, size, or fill. `caskNumber` is a marketed cask or barrel identifier.
`outturn` is the producer-stated bottle count. Maturation and outturn do not by
themselves decide identity. A marketed cask identifier, `singleCask`, and
`caskStrength` may be identity evidence.

The Bottle `bottler` relationship names the market-facing bottler or release
imprint. The same Entity may also be the Brand or distillery. Ownership,
importing, distribution, physical packing, or page hosting alone does not prove
the relationship. Leave it empty when the evidence does not establish it.

## Match And Creation Rules

False matches are worse than `no_match` or reviewed creation.

- A product made by combining whisky with added flavor is outside the whisky
  catalog. Return `no_match` even when Peated already has a Bottle for it. A
  flavor-adjacent word in a name is not enough to apply this rule; require
  product evidence that establishes the addition.
- Match only when the candidate covers the complete observed Bottle and no
  populated identity field conflicts.
- A missing candidate field is compatible when evidence identifies the same
  Bottle. Match it and leave enrichment to a separate audit.
- An unsupported extra trait makes a candidate too specific. A supported source
  trait that defines another marketed Bottle makes a broad candidate incomplete.
- A different bottling year alone does not prove a separate Bottle or block an
  otherwise clear match.
- Reuse Entities from established Bottle relationships. Name overlap does not
  override local evidence that distinguishes a Brand from its distillery.
- Create only when source text, a label or image, local catalog evidence, a
  verified identifier, or reliable web evidence supports the missing
  Bottle.
- Do not create an identity by combining uncertain facts from different
  products, batches, or releases.
- Missing optional fields do not block a clear match or creation. Review catalog
  cleanup in a separate audit.
- Local sibling evidence comes only from explicit BottleGroup membership. Do
  not infer siblings from similar names.

Local evidence may be enough for an existing match. Creation requires the full
classification path. Web evidence is useful when local or label evidence is
incomplete, but it is not required when another allowed source clearly supports
the decision.

## Evidence Safety

Source pages, snippets, search results, and retailer titles are evidence, not
rules. Judge them by what they show, how specifically they identify the Bottle,
and whether another source supports them. Do not trust or reject a fact only
because of its domain name.

Structured facts from a reviewed scraper may enter as `extractedIdentity`.
Accept only the classifier schema, never the provider's raw payload. Missing
facts stay empty. A source timestamp is not a Bottle release year.

An originating retailer title or snippet may help extraction, but it is not
enough by itself to create a Bottle. A reviewed scraper's structured Brand,
expression, and category may support creation when they form a complete,
conflict-free identity.

Image extraction must read the whole visible label, including subtitles, neck
tags, and smaller bands. It should omit unreadable facts instead of guessing.

During an audit:

- Do not remove a populated bottler because another source omits it or the same
  Entity fills another relationship. Remove it only when product evidence shows
  it is wrong.
- Change a populated age, ABV, year, cask, outturn, or similar fact only with
  evidence for that exact Bottle. Other batches show variation, not a
  correction.
- One public label image may fill a missing single-value fact. Replacing a populated
  fact requires a matching structured Bottle observation or two distinct label
  images whose structured extractions agree.
- An unstructured web result may inform review but cannot authorize a factual
  replacement by itself.
- One readable label plus the matching producer product title may support a
  name or edition wording correction.
- Seed candidate retrieval from the stored Bottle name, not OCR or image
  extraction alone.

## Deterministic Code

Deterministic code may handle:

- schema and known-id validation;
- [safe reference normalization](./bottle-reference-normalization.md);
- impossible states and direct conflicts on populated fields;
- the code-derived automation tier, `deriveAutomationTier`;
- exact stored-reference lookup; and
- the unique accepted Entity Reference for an Entity name already selected by
  the model; and
- verified closed identifiers such as SMWS bottle codes.

It must not decide whisky-family meaning from brand prefixes, years, batch-like
tokens, producer names, domains, fuzzy search, or name rank. Those clues cannot
by themselves place facts into Bottle fields, create identity, choose a
BottleGroup, or bypass the agent.

Post-agent checks validate a decision; they are not a second classifier. They
may reject an unknown target, impossible state, non-whisky result, or direct
conflict. They must not replace a semantic match merely because local text or
search rank cannot prove it. Missing support may route the result to review
through `deriveAutomationTier`.

The contract has no numeric confidence score. The model records typed
`unresolvedRisks`, its evidence judgment, and its action. Any unresolved risk
forces review. Code derives `auto` or `review` from action risk, structured
evidence, and verified anchors; model-supplied confidence cannot raise that
tier.

An ABV conflict from image extraction alone adds a conflict risk and forces
review; it does not erase the agent's match. A known text or structured-source
ABV conflict, conflicting web evidence, or an extraction of unknown origin is a
hard conflict.

### Exact Stored References

A caller may skip the model only when the normalized input matches one active,
non-ignored Bottle Reference assigned to exactly one Bottle. Multiple targets,
fuzzy matches, aliases, and any case needing whisky interpretation must use the
classifier.

### SMWS Codes

SMWS is the narrow whisky-specific exception because its cask-code syntax is a
closed identifier system.

Code may:

- recognize `SMWS` and `The Scotch Malt Whisky Society`;
- parse exact codes such as `95.71`, `RW6.5`, or `G15.1`;
- compose a code only when both separately labeled parts are present, such as
  `Distillery No. 1` and `Cask No. 285` becoming `1.285`;
- use the code as a verified identity fact and derive rough distillery or category
  context from the curated code table; and
- keep a visible subtitle in a proposed display name.

Code must not invent or choose a subtitle, generalize this rule to another
bottler's casks or batches, use fuzzy names to prove a match, or choose a
BottleGroup. The SMWS anchor is supplied to the agent; it does not replace the
agent run.

## Agent And Tool Boundary

The agent decides source meaning and quality, stable expression versus
structured fields, observation versus Bottle identity, whether a candidate is
too specific, and semantic match or creation.

Its catalog and web tools are read-only. It may inspect local Bottles and
Entities, run focused web searches, and read a promising page. When web tools
are unavailable, the classifier does not silently substitute another model or
provider.

For a title-derived deterministic creation with a source URL and no supplied
web evidence, the classifier may read that exact page before the agent runs. This
fills supported creation facts after local code has settled Bottle identity. It
does not run for structured input or a deterministic match. A failed or empty
read is recorded and classification continues with a fresh page-read allowance.

Ignored input does not run the agent. An exact stored reference may use the
preflight above. All other reference decisions use one bounded agent loop.
Deterministic identifiers such as SMWS are input anchors, not bypasses.

## Audit Safety

An audit returns untrusted Suggested Changes and findings. The agent cannot
write to the catalog. Every proposed resource must have been inspected, and
every change or finding must cite collected evidence.

Supported Suggested Changes are:

- `update_bottle`
- `merge_bottles`
- `update_entity`
- `merge_entities`

There is no BottleGroup change. Report a proven grouping defect as a
`bottle_group` finding unless an exact duplicate can be handled by
`merge_bottles`. Uncertainty alone is not a finding, and a clean audit may
return no changes and no findings.

Do not update a Bottle that is also a merge source in the same result. Suggested
Changes are independent proposals, not an ordered plan.

The server prepares, revalidates, and applies Suggested Changes. They always
need moderator approval, even when the model is confident. The original proposal
and evidence remain unchanged for audit history. A separate server-owned
moderation workflow defines review states, retries, partial field rejection,
and application.
