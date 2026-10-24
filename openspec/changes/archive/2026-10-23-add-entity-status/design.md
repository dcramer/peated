## Context

Entities store identity, ownership, description, establishment year, website, and location, but not current status. Dated Entity events can record openings and closures, but callers must not guess current status from incomplete history. The existing location fields also need one stable meaning across the API and interface.

## Goals / Non-Goals

**Goals:**

- Store one optional current status on each Entity.
- Keep status values small and specific to whisky catalog records.
- Make status available for editing, display, and list filtering.
- Define Entity location as origin rather than headquarters or office location.

**Non-Goals:**

- Add status dates or sources.
- Derive status from Entity history or update history from status.
- Add new image kinds or Brand profile fields.
- Add separate origin and headquarters fields.

## Decisions

### Store one status field

Add a nullable `status` column to `entity`. Null means Peated does not know the current status. The allowed stored values are `active`, `mothballed`, `closed`, and `discontinued`.

`active` is valid for every Entity kind. `mothballed` is valid only for a Distillery. `discontinued` is valid only for a Brand. `closed` is valid for a Distillery, Bottler, or Company. The server validates the final kind and status together when an Entity is created or updated, including when its kind changes.

Alternative: add separate status fields or enums for each Entity kind. Rejected because callers need one current status and the extra fields add no value.

Alternative: derive status from Entity history. Rejected because history may be incomplete and a current status may be known without a dated opening or closure event.

### Keep status and history separate

Status describes the Entity now. History events describe dated facts. Creating or editing either one does not silently write the other.

### Make location mean origin

Keep the existing country, region, address, and coordinates. Define them as the place the Entity comes from. For a Distillery, this is its production site. Do not replace them with a later headquarters or office.

Keep this rule beside the database fields and in the public API field descriptions. Label the edit and detail interface as Origin so moderators and readers see the same meaning.

Alternative: add separate origin fields. Rejected because Peated has no current need to store headquarters or offices.

## Risks / Trade-offs

- A status can disagree with incomplete history. Status remains the explicit current fact; history remains a list of dated facts.
- Existing Entity locations may contain headquarters or office data. This change defines future behavior but does not guess which existing rows need correction.
- Restricting status by kind makes kind changes stricter. The update must supply a valid status or clear the old one.

## Migration Plan

Generate a migration that adds the nullable status enum and column. Existing Entities remain null, because their current status is not known from the existing row alone. Rollback removes the column and enum without changing Entity identity or relationships.

## Open Questions

None.
