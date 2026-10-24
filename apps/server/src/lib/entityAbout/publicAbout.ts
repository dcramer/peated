import type {
  AboutCitation,
  AboutLinkedEntity,
  AboutSection,
  EntityAboutPublic,
} from "@peated/server/schemas/entityAbout";

import { ABOUT_FACT_FIELD_LIST, ABOUT_FACT_FIELDS } from "./aboutFactFields";
import {
  eventFactId,
  getDateDisagreement,
  getDisagreement,
  getFactCitations,
  getShownFactIds,
  hasEntityAboutPage,
  siteFactId,
} from "./display";
import type { StoredEntityAbout } from "./store";

const publicCitations = (citations: readonly AboutCitation[]) =>
  citations.map(({ sourceId, statedValue }) => ({ sourceId, statedValue }));

function serializeSection(
  section: AboutSection,
  shown: Set<string>,
  sourceIdsForFact: (factId: string) => string[],
) {
  // A sentence whose facts are hidden would state something unsourced.
  const sentences = section.sentences
    .filter((sentence) => sentence.factIds.every((id) => shown.has(id)))
    .map((sentence) => ({
      text: sentence.text,
      sourceIds: [...new Set(sentence.factIds.flatMap(sourceIdsForFact))],
      factIds: sentence.factIds,
    }));
  return sentences.length
    ? {
        key: section.key,
        heading: section.heading,
        eraEventId: section.eraEventId,
        sentences,
      }
    : null;
}

/**
 * Builds the public About page from a stored document: shown facts only, no
 * quotes, and only sentences whose facts are all shown.
 */
export function toPublicEntityAbout(
  item: Pick<
    StoredEntityAbout,
    "entityId" | "document" | "version" | "checkedOn"
  >,
  linkedEntities: ReadonlyMap<number, AboutLinkedEntity>,
): EntityAboutPublic {
  const { document } = item;
  const shown = getShownFactIds(document);
  // Merge rule (owner: `mergeEntity`): an owner later merged into this
  // Entity would read as the Entity buying itself, so that event is hidden.
  for (const event of document.events) {
    const owner = event.newOwnerId && linkedEntities.get(event.newOwnerId);
    if (owner && owner.id === item.entityId)
      shown.delete(eventFactId(event.id));
  }
  const factCitations = getFactCitations(document);
  const sourceIdsForFact = (factId: string) =>
    (factCitations.get(factId) ?? []).map((c) => c.sourceId);

  const events = document.events
    .filter((event) => shown.has(eventFactId(event.id)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    .map((event) => ({
      id: event.id,
      kind: event.kind,
      date: event.date,
      endDate: event.endDate,
      continuing: event.continuing,
      name: event.name,
      title: event.title,
      text: event.text,
      relatedEntity: event.relatedEntityId
        ? (linkedEntities.get(event.relatedEntityId) ?? null)
        : null,
      newOwner: event.newOwnerId
        ? (linkedEntities.get(event.newOwnerId) ?? null)
        : null,
      newOwnerName: event.newOwnerName,
      citations: publicCitations(event.citations),
      disagreement: getDateDisagreement(event.citations),
    }));

  const siteFacts = ABOUT_FACT_FIELD_LIST.flatMap((field) => {
    const fact = document.siteFacts[field];
    if (!fact || !shown.has(siteFactId(field))) return [];
    return [
      {
        field,
        label: ABOUT_FACT_FIELDS[field].label,
        value: fact.value,
        unit: ABOUT_FACT_FIELDS[field].unit,
        asOf: fact.asOf,
        citations: publicCitations(fact.citations),
        // Text facts are worded differently by each source; only numbers
        // can disagree.
        disagreement:
          ABOUT_FACT_FIELDS[field].type === "number"
            ? getDisagreement(fact.citations)
            : null,
      },
    ];
  });

  const sections = document.sections
    .map((section) => serializeSection(section, shown, sourceIdsForFact))
    .filter((section) => section !== null);

  const citedSourceIds = new Set([...shown].flatMap(sourceIdsForFact));

  return {
    entityId: item.entityId,
    version: item.version,
    checkedOn: item.checkedOn,
    lead: sections.find((section) => section.key === "lead") ?? null,
    sections: sections.filter((section) => section.key !== "lead"),
    events,
    siteFacts,
    sources: document.sources.filter((source) => citedSourceIds.has(source.id)),
  };
}

/**
 * The published lead as plain text, or null for a hidden page or one without
 * a shown lead. Description rule (owner: docs/features/entity-about.md): a
 * generated description is kept only when it equals this text.
 */
export function getPublishedLeadText(
  item: StoredEntityAbout | null,
  linkedEntities: ReadonlyMap<number, AboutLinkedEntity>,
) {
  if (item?.status !== "published") return null;
  const lead = toPublicEntityAbout(item, linkedEntities).lead;
  return lead?.sentences.map((sentence) => sentence.text).join(" ") || null;
}

/**
 * Whether the About tab shows. Tab rule (owner:
 * docs/features/entity-about.md): the page is published and has enough to
 * show, counted the way the page itself shows it.
 */
export function hasPublishedAboutPage(
  item: StoredEntityAbout | null,
  linkedEntities: ReadonlyMap<number, AboutLinkedEntity>,
) {
  return (
    item?.status === "published" &&
    hasEntityAboutPage(toPublicEntityAbout(item, linkedEntities))
  );
}
