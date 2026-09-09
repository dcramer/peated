## ADDED Requirements

### Requirement: Removed content is absent from public aggregation

The system SHALL exclude moderator-removed tastings, member reviews, and critic reviews from every ordinary row-level list, activity feed, public count, and saved tasting-note summary regardless of the viewer's relationship to the author.

#### Scenario: Public member record is removed

- **WHEN** an administrator removes a public member review or tasting
- **THEN** the record disappears from Bottle, Entity, global, and profile lists
- **AND** it no longer contributes to public review-and-tasting counts or tasting-note summaries after recomputation

#### Scenario: Private member record is removed

- **WHEN** an administrator removes a private member review or tasting
- **THEN** the author and accepted followers can no longer read it through ordinary lists or details
- **AND** it does not contribute anonymous public tasting-note data

#### Scenario: Published critic review is removed

- **WHEN** an administrator removes a published visible critic review
- **THEN** the review disappears from combined lists, active critic placement, public counts, and tasting-note summaries

#### Scenario: Removed content is restored

- **WHEN** an administrator restores removed content
- **THEN** the content becomes eligible again only when its ordinary member privacy, critic publication, critic visibility, and active Bottle rules permit it

### Requirement: Removed content cannot receive public interactions

The system SHALL treat a removed source record as absent when an ordinary route attempts to load it for comments, toasts, notifications, badges, sitemaps, or other source-specific public behavior.

#### Scenario: User follows an old tasting link

- **WHEN** a user opens the public URL for a removed tasting
- **THEN** the system returns the same not-found behavior used for absent content and does not expose its Bottle, author, notes, or image

#### Scenario: User interacts through a stale client

- **WHEN** a stale client submits a comment or toast for a tasting removed after the page loaded
- **THEN** the server rejects the interaction and does not create a notification or change a count

#### Scenario: Sitemap is generated

- **WHEN** the tasting sitemap is generated after content removal
- **THEN** removed tasting URLs are not included
