import type {
  AboutCitation,
  AboutSection,
  EntityAboutPublic,
} from "@peated/server/schemas/entityAbout";

import { ABOUT_FACT_FIELD_LIST, ABOUT_FACT_FIELDS } from "./aboutFactFields";
import {
  getDisagreement,
  getShownFactIds,
  isFactShown,
  siteFactId,
} from "./display";
import type { StoredEntityAbout } from "./store";

export type AboutLinkedEntity = {
  id: number;
  name: string;
  kind: "brand" | "distillery" | "bottler" | "company";
};

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
  const citationsByFact = new Map<string, readonly AboutCitation[]>();
  const sourceIdsForFact = (factId: string) =>
    (citationsByFact.get(factId) ?? []).map((c) => c.sourceId);

  const events = document.events
    .filter((event) => isFactShown(event.citations, document.sources))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    .map((event) => {
      citationsByFact.set(`event:${event.id}`, event.citations);
      return {
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
        disagreement: getDisagreement(event.citations),
      };
    });

  const siteFacts = ABOUT_FACT_FIELD_LIST.flatMap((field) => {
    const fact = document.siteFacts[field];
    if (!fact || !isFactShown(fact.citations, document.sources)) return [];
    citationsByFact.set(siteFactId(field), fact.citations);
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

  const citedSourceIds = new Set<string>();
  for (const citations of citationsByFact.values()) {
    for (const citation of citations) citedSourceIds.add(citation.sourceId);
  }

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
