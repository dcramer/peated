# Moderation Workspace Mockups

These mockups were generated with the built-in image generation tool. They establish hierarchy, density, and visual direction. `../design.md` and `../specs/moderation-workspace/spec.md` are authoritative for behavior.

## Shared Prompt

> Create a realistic, shippable Peated moderator web UI in a dark slate visual system: slate-950 background, slate-900 surfaces, thin slate-800 borders, white primary text, muted slate secondary text, restrained amber `#fbbf24` highlights, and small semantic success/error accents. Use crisp practical typography, accessible contrast, realistic spacing, and no concept-art styling. Center the product on a human decision rather than classifier or queue machinery. Avoid giant cards, model confidence scores, automation scores, charts in decision views, gradients, glassmorphism, watermarking, and unrelated logos.

Desktop Inbox screens use three columns: Moderation/Admin navigation, a compact task list, and a focused detail workspace. Preserve the same shell between task variants. Mobile uses a list route followed by a full-screen detail route; never squeeze all three desktop columns onto a phone.

## Screen Prompts

### Listing decision

> Select an incoming listing named `Ardbeg Uigeadail 700mL`. Ask `Which Bottle should this listing use?` Show its source, the recommended existing `Ardbeg Uigeadail` Bottle, three short supporting identity facts, one primary `Approve match` action, choose-another and ignore alternatives, and default-closed evidence and system disclosures.

### Catalog field change

> Select `Update GlenDronach release year`. Ask `Should these Bottle fields change?` Show an includable current/proposed diff for Edition, Release year, and ABV, the supporting producer/label evidence, an `Apply 3 changes` primary action, manual-edit and remove alternatives, and the bounded impact on one Bottle.

### Blocked listing

> Select `Unknown Islay Single Malt`. Ask `How should this unresolved listing continue?` Explain `NO SAFE MATCH` in human language with the missing producer, age/edition, and image evidence. Offer manual Bottle selection as the primary action, with valid retry and ignore alternatives. Keep candidates, evidence, and system details collapsed.

### History

> Select History and show a compact chronological list of moderator and automated outcomes. Detail a completed listing-to-Bottle match with durable actor, time, outcome, source-to-Bottle relationship, rationale, and a three-step activity sequence. Do not offer actions that repeat the completed decision.

### Automation

> Select Automation and show bounded operational health: Processing, Waiting, Failed, and Cleared-today counts; concise needs-attention rows with source-owned Retry, Open task, Run new audit, or Resume actions; and recent runs with factual progress. State that catalog decisions remain in the Inbox.

### Mobile

> Show two responsive phone screens: the compact filtered Inbox and a full-screen listing decision. Use reachable bottom destination navigation, a back control from detail, at least 44-pixel touch targets, full-width decision actions, default-closed disclosures, and no horizontal overflow.

## Authoritative Interaction Note

The exploratory images sometimes show both `Skip` and `Next task` before disposition. The accepted design provides only `Skip` while a task remains open. Successful disposition advances automatically. A terminal completion state can offer `Next task` only when automatic navigation cannot occur.
