## Purpose

Define configured collection of official product catalogs without changing Bottle data.

## Requirements

### Requirement: Administrator can configure an official catalog source

The system SHALL allow an administrator to configure an external site as an official product catalog source. Its versioned rules read product lists and pages without requiring review or price fields.

#### Scenario: Catalog rules are valid

- **WHEN** an administrator supplies catalog rules with a product list, product link, and displayed product name
- **THEN** the system accepts the rules without requiring a review body, price, currency, or volume

#### Scenario: Existing rule revisions remain stable

- **WHEN** the system loads a stored configured rule revision created before catalog support
- **THEN** it validates and runs that revision with its original review or price fields

### Requirement: Catalog preview does not write records

The system SHALL preview catalog products with the same parser and validation rules used by collection runs. Preview does not save catalog listings or change Bottle-related records.

#### Scenario: Administrator previews a product

- **WHEN** an administrator previews valid catalog rules against a product page
- **THEN** the system returns the product name, preferred page URL, optional product ID, optional image URL, and supported bottle details
- **AND** it creates no catalog listing, Bottle, Bottle reference, Bottle observation, review, or store price

### Requirement: Catalog listings preserve source details

The system SHALL store each observed product under its catalog source. The product ID identifies it when present; otherwise, the preferred product page URL does.

#### Scenario: A new product is observed

- **WHEN** a catalog run finds a product ID or page URL that is not saved for the external site
- **THEN** the system stores one listing with its product name, page URL, selected bottle details, change-detection hash, first-seen time, and last-seen time

#### Scenario: The same product is observed again

- **WHEN** a later catalog run observes the same source product
- **THEN** the system updates that listing and its last-seen time without creating a duplicate

#### Scenario: Product ID and URL conflict

- **WHEN** a product ID and page URL point to different existing listings
- **THEN** the system rejects the result for review and does not silently merge or overwrite either listing

### Requirement: Catalog collection does not change Bottle data

The system MUST limit a catalog run to catalog-listing writes, run status, and logs.

#### Scenario: A valid catalog product is collected

- **WHEN** the runtime processes a valid catalog product
- **THEN** it creates or updates a catalog listing
- **AND** it creates or updates no Bottle, Bottle group, Series, Bottle reference, Bottle observation, review, or store price

### Requirement: Missing products are not deleted

The system MUST NOT treat absence from a later crawl as evidence that a listing or Bottle was withdrawn.

#### Scenario: A previously seen product is absent

- **WHEN** a completed or partial run does not observe an existing catalog listing
- **THEN** the system preserves the listing and its previous last-seen time
- **AND** it does not delete, retire, hide, or change Bottle data

### Requirement: Administrators can inspect collected listings

The system SHALL provide administrators with a paged list of collected products and counts for the details those products include.

#### Scenario: Administrator views a catalog source

- **WHEN** an authorized administrator opens a configured catalog source
- **THEN** the system shows its collected products with product ID or page URL, bottle details, first-seen time, and last-seen time

#### Scenario: Public or unauthorized caller requests listings

- **WHEN** a caller without administrator permission requests the collected catalog products
- **THEN** the system denies access without exposing listing data

### Requirement: Catalog collection keeps only needed page content

The system SHALL store selected product details and the source page URL without retaining raw pages, full product descriptions, or tasting notes.

#### Scenario: Product page includes long-form prose

- **WHEN** a catalog product page contains a description or tasting notes
- **THEN** the catalog parser does not include that prose in the persisted listing or normal logs
