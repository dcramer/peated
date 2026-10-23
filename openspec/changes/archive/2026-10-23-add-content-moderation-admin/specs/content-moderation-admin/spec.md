## ADDED Requirements

### Requirement: Content administration is administrator-only

The system SHALL require administrator authority for every Content admin page, list, detail, history read, removal, and restoration action. Administrator access SHALL NOT make private or removed content available through ordinary APIs.

#### Scenario: Administrator opens member content

- **WHEN** an authenticated administrator opens a private member review or tasting through Content admin
- **THEN** the system returns the content needed for moderation and labels it private

#### Scenario: Non-administrator requests Content admin

- **WHEN** a user without administrator authority requests a Content admin page or API
- **THEN** the system rejects the request without returning summaries, excerpts, or content

#### Scenario: Administrator uses an ordinary detail route

- **WHEN** an administrator requests a removed record through its ordinary public or member detail route
- **THEN** the system treats the record as absent

### Requirement: Admin navigation separates content inventory from queued moderation

The system SHALL provide a Content admin navigation group with Reviews and Tastings. Reviews SHALL contain separate Member reviews and Critic reviews tabs. These destinations SHALL remain separate from the Moderation Inbox.

#### Scenario: Administrator opens Reviews

- **WHEN** an administrator selects Reviews
- **THEN** the system opens Member reviews by default and offers a Critic reviews tab under the same Reviews heading

#### Scenario: Administrator opens Tastings

- **WHEN** an administrator selects Tastings
- **THEN** the system opens the tasting inventory without mixing review scores and tasting bands into one content type

#### Scenario: Content does not require a pending task

- **WHEN** an administrator investigates a review or tasting that has no queued decision
- **THEN** the record remains findable in Content and does not appear in the Moderation Inbox solely because it exists

### Requirement: Content lists are searchable, stable, and source-specific

The system SHALL provide newest-first paginated lists for member reviews, critic reviews, and tastings with a stable ID tie-breaker. Each list SHALL support active, removed, and all statuses and identity search without searching member notes or critic clips.

#### Scenario: Administrator browses member reviews

- **WHEN** the administrator opens the Member reviews tab
- **THEN** each row identifies the member, Bottle, score, bounded content excerpt, privacy, date, and moderation status

#### Scenario: Administrator browses critic reviews

- **WHEN** the administrator opens the Critic reviews tab
- **THEN** each row identifies the critic site, Bottle match, native score, bounded clip, publication context, date, and moderation status

#### Scenario: Administrator browses tastings

- **WHEN** the administrator opens Tastings
- **THEN** each row identifies the member, Bottle, rating band, bounded content excerpt, privacy, date, and moderation status

#### Scenario: Administrator searches content inventory

- **WHEN** the administrator searches by source ID, member identity, critic site, or Bottle identity
- **THEN** the system filters the selected source list without matching or placing private notes or clips in the query

#### Scenario: Records share a date

- **WHEN** two records have the same newest-first timestamp
- **THEN** their IDs provide a deterministic order across pages

### Requirement: Content details expose only necessary moderation content

The system SHALL provide stable administrator detail pages that show the source content and context necessary to make a moderation decision. It MUST NOT include complete content in logs, traces, audit metadata, or errors.

#### Scenario: Administrator inspects a member review

- **WHEN** the administrator opens a member review detail
- **THEN** the system shows its member, Bottle, privacy, score, notes, flavor sections, serving context, image, dates, moderation state, and bounded moderation history

#### Scenario: Administrator inspects a tasting

- **WHEN** the administrator opens a tasting detail
- **THEN** the system shows its member, Bottle, privacy, rating band, notes, tags, serving context, image, interaction counts, dates, moderation state, and bounded moderation history

#### Scenario: Administrator inspects a critic review

- **WHEN** the administrator opens a critic review detail
- **THEN** the system shows its site, article link and facts, Bottle match, native score, clip, extracted tags, publication and staging context, dates, moderation state, and bounded moderation history

#### Scenario: Critic review has a stored parser body

- **WHEN** an administrator opens a critic review whose complete article body is stored internally
- **THEN** no Content admin schema, response, or page returns that stored body

### Requirement: Manual content removal is reversible and durable

The system SHALL let an administrator remove or restore one member review, critic review, or tasting. Every state transition SHALL require a non-empty bounded reason, identify the administrator actor, record the transition time, and append durable history without copying the moderated content.

#### Scenario: Administrator removes active content

- **WHEN** an administrator confirms `Remove from Peated` with a valid reason
- **THEN** the source record becomes removed
- **AND** the current state records the time, actor, and reason
- **AND** durable history records the removal without notes, clips, images, or direct member identifiers

#### Scenario: Administrator restores removed content

- **WHEN** an administrator confirms `Restore to Peated` with a valid reason
- **THEN** the source record becomes active
- **AND** durable history records the restoration before current removal fields are cleared

#### Scenario: Reason is missing

- **WHEN** an administrator submits removal or restoration without a non-empty valid reason
- **THEN** the system rejects the request without changing state or recording history

#### Scenario: Requested state is already current

- **WHEN** an administrator repeats the same moderation state request
- **THEN** the system returns the current state without adding duplicate history or dispatching duplicate summary work

#### Scenario: Moderation mutation races another update

- **WHEN** moderation and another write target the same source record concurrently
- **THEN** the system locks and revalidates the record before applying the transition

### Requirement: Critic moderation is independent from publication workflow

The system MUST store manual removal separately from external-review `hidden` state and source publication approval. Scraping, matching, and publication changes MUST NOT clear manual removal.

#### Scenario: Removed critic review is imported again

- **WHEN** a scraper refreshes a manually removed critic review
- **THEN** source-owned fields may update and the review remains manually removed

#### Scenario: Removed critic source is approved

- **WHEN** a critic source is approved for publication while one of its reviews is manually removed
- **THEN** the review remains unavailable outside Content admin regardless of its `hidden` value

#### Scenario: Staged critic review is not manually removed

- **WHEN** an external review is hidden only because it is unresolved or staged
- **THEN** Content admin labels the staging state separately and does not claim an administrator removed it

### Requirement: Removed content is frozen outside administrator moderation

The system SHALL reject ordinary updates, image changes, comments, and toasts for removed content. It SHALL retain the member's existing permanent deletion ability.

#### Scenario: Member updates a removed review

- **WHEN** a member attempts to save over their removed member review
- **THEN** the system rejects the update and does not clear removal

#### Scenario: Member interacts with a removed tasting

- **WHEN** a user attempts to comment on, toast, or change an image for a removed tasting
- **THEN** the system rejects the action without creating or changing interaction data

#### Scenario: Owner deletes removed content

- **WHEN** the owner permanently deletes their removed member review or tasting
- **THEN** the system completes the existing owner deletion behavior without restoring the content first

#### Scenario: Administrator reviews content

- **WHEN** an administrator opens removed content in Content admin
- **THEN** the administrator can inspect, restore, or leave it removed but cannot rewrite the member's content or rating

### Requirement: Moderation actions explain impact and preserve input

The Content admin UI SHALL describe removal as reversible visibility moderation, require the reason in a confirmation form, and preserve the administrator's input when a mutation fails.

#### Scenario: Administrator starts removal

- **WHEN** the administrator selects `Remove from Peated`
- **THEN** the confirmation explains that the content will disappear from Peated but remain available to administrators and requires a reason

#### Scenario: Moderation save fails

- **WHEN** a removal or restoration request fails
- **THEN** the page keeps the entered reason, displays the error near the action, announces it accessibly, and leaves the record state unchanged

#### Scenario: Moderation save succeeds

- **WHEN** a removal or restoration request succeeds
- **THEN** the page refreshes the record and affected list state, shows the new status, moves focus predictably, and announces success
