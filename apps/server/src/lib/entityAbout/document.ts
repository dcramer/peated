import type { EntityAboutDocument } from "@peated/server/schemas/entityAbout";

import { ABOUT_FACT_FIELD_LIST } from "./aboutFactFields";
import { getFactCitations } from "./display";

export function normalizeSourceUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.protocol = "https:";
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.hostname}${path}${url.search}`;
}

/** Removes sources that no citation uses. */
export function pruneSources(
  document: EntityAboutDocument,
): EntityAboutDocument {
  const used = new Set<string>();
  for (const citations of getFactCitations(document).values()) {
    for (const citation of citations) used.add(citation.sourceId);
  }
  return {
    ...document,
    sources: document.sources.filter((source) => used.has(source.id)),
  };
}

/**
 * Returns why a document cannot be saved. Source rule (owner:
 * docs/features/entity-about.md): every event and site fact cites a source,
 * and every sentence cites facts.
 */
export function findAboutWriteErrors(next: EntityAboutDocument) {
  const errors: string[] = [];

  const sourceIds = new Set<string>();
  const sourceUrls = new Set<string>();
  for (const source of next.sources) {
    if (sourceIds.has(source.id))
      errors.push(`Source ${source.id} is listed twice.`);
    const url = normalizeSourceUrl(source.url);
    if (sourceUrls.has(url))
      errors.push(`Source ${source.url} is listed twice.`);
    sourceIds.add(source.id);
    sourceUrls.add(url);
  }

  const factCitations = getFactCitations(next);
  for (const [factId, citations] of factCitations) {
    for (const citation of citations) {
      if (!sourceIds.has(citation.sourceId)) {
        errors.push(`${factId} cites unknown source ${citation.sourceId}.`);
      }
    }
  }

  const eventIds = new Set<number>();
  for (const event of next.events) {
    if (eventIds.has(event.id))
      errors.push(`Event ${event.id} is listed twice.`);
    eventIds.add(event.id);
  }

  for (const event of next.events) {
    if (!event.citations.length) {
      errors.push(`Event ${event.id} needs a source.`);
    }
  }

  for (const field of ABOUT_FACT_FIELD_LIST) {
    const fact = next.siteFacts[field];
    if (fact && !fact.citations.length) {
      errors.push(`Site fact ${field} needs a source.`);
    }
  }

  const factIds = new Set(factCitations.keys());
  const sectionKeys = new Set<string>();
  for (const section of next.sections) {
    if (sectionKeys.has(section.key)) {
      errors.push(`Section ${section.key} is listed twice.`);
    }
    sectionKeys.add(section.key);
    // Every section but the lead is labeled by its heading.
    if (section.key !== "lead" && !section.heading) {
      errors.push(`Section ${section.key} needs a heading.`);
    }
    if (section.eraEventId && !eventIds.has(section.eraEventId)) {
      errors.push(`Section ${section.key} names a missing era.`);
    }
    for (const sentence of section.sentences) {
      if (!sentence.factIds.length) {
        errors.push(`A sentence in ${section.key} needs a source.`);
      }
      for (const factId of sentence.factIds) {
        if (!factIds.has(factId)) {
          errors.push(`A sentence in ${section.key} cites missing ${factId}.`);
        }
      }
    }
  }

  return errors;
}
