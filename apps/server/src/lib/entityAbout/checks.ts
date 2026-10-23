import type {
  AboutCitation,
  EntityAboutDocument,
} from "@peated/server/schemas/entityAbout";

import { ABOUT_FACT_FIELD_LIST, ABOUT_FACT_FIELDS } from "./aboutFactFields";
import { findBannedPhrases } from "./bannedPhrases";
import {
  eventFactId,
  getDisagreement,
  getShownFactIds,
  siteFactId,
} from "./display";
import { normalizeSourceUrl, pruneSources } from "./document";

export const ABOUT_MAX_SENTENCE_WORDS = 30;
export const ABOUT_MAX_LEAD_SENTENCES = 4;
export const ABOUT_MIN_FACTS_FOR_PROSE = 2;
export const ABOUT_MIN_FACTS_FOR_SECTIONS = 6;

/** A page the writer read during one run. */
export type AboutPageRead = { url: string; text: string };

function normalizeForQuote(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Evidence rule (owner: docs/features/entity-about.md): a pipeline citation
 * stands only when its quote appears on a page read in the same run. Facts
 * left without citations are dropped, then unused sources.
 */
export function keepVerifiedCitations(
  draft: EntityAboutDocument,
  pages: readonly AboutPageRead[],
): EntityAboutDocument {
  const pageText = new Map<string, string>();
  for (const page of pages) {
    const url = normalizeSourceUrl(page.url);
    pageText.set(
      url,
      `${pageText.get(url) ?? ""} ${normalizeForQuote(page.text)}`,
    );
  }
  const sourceUrls = new Map(
    draft.sources.map((source) => [source.id, normalizeSourceUrl(source.url)]),
  );

  const isVerified = (citation: AboutCitation) => {
    if (!citation.quote) return false;
    const url = sourceUrls.get(citation.sourceId);
    const text = url ? pageText.get(url) : undefined;
    const quote = normalizeForQuote(citation.quote);
    return Boolean(text && quote && text.includes(quote));
  };

  const events = draft.events
    .map((event) => ({
      ...event,
      citations: event.citations.filter(isVerified),
    }))
    .filter((event) => event.citations.length > 0);

  const siteFacts: EntityAboutDocument["siteFacts"] = {};
  for (const field of ABOUT_FACT_FIELD_LIST) {
    const fact = draft.siteFacts[field];
    if (!fact) continue;
    const citations = fact.citations.filter(isVerified);
    if (citations.length) siteFacts[field] = { ...fact, citations };
  }

  return pruneSources({ ...draft, events, siteFacts });
}

function factSearchText(document: EntityAboutDocument) {
  const texts = new Map<string, string>();
  const citationText = (citations: readonly AboutCitation[]) =>
    citations.map((c) => `${c.statedValue ?? ""} ${c.quote ?? ""}`).join(" ");

  for (const event of document.events) {
    texts.set(
      eventFactId(event.id),
      [
        event.date,
        event.endDate,
        event.name,
        event.title,
        event.text,
        event.newOwnerName,
        citationText(event.citations),
      ].join(" "),
    );
  }
  for (const field of ABOUT_FACT_FIELD_LIST) {
    const fact = document.siteFacts[field];
    if (!fact) continue;
    texts.set(
      siteFactId(field),
      [fact.value, fact.asOf, citationText(fact.citations)].join(" "),
    );
  }
  return texts;
}

const NUMBER_PATTERN = /\d+(?:\.\d+)?/g;

function stripThousands(value: string) {
  return value.replace(/(\d),(?=\d{3}\b)/g, "$1");
}

function containsNumber(text: string, number: string) {
  return new RegExp(`(?<![\\d.])${number.replace(".", "\\.")}(?![\\d])`).test(
    stripThousands(text),
  );
}

/**
 * Checks pipeline prose against the facts it cites. Each check compares exact
 * text; tone and meaning are not judged here.
 */
export function checkAboutProse(document: EntityAboutDocument) {
  const errors: string[] = [];
  const shown = getShownFactIds(document);
  const factText = factSearchText(document);
  const sentences = document.sections.flatMap((section) =>
    section.sentences.map((sentence) => ({ section, sentence })),
  );
  const lead = document.sections.find((section) => section.key === "lead");
  const others = document.sections.filter((section) => section.key !== "lead");

  if (sentences.length && !lead) errors.push("Prose needs a lead section.");
  if (shown.size < ABOUT_MIN_FACTS_FOR_PROSE && sentences.length) {
    errors.push(
      `Only ${shown.size} facts are shown; prose needs at least ${ABOUT_MIN_FACTS_FOR_PROSE}.`,
    );
  }
  if (shown.size < ABOUT_MIN_FACTS_FOR_SECTIONS && others.length) {
    errors.push(
      `Only ${shown.size} facts are shown; sections beyond the lead need at least ${ABOUT_MIN_FACTS_FOR_SECTIONS}.`,
    );
  }
  if (
    lead &&
    lead.sentences.length > Math.min(ABOUT_MAX_LEAD_SENTENCES, shown.size)
  ) {
    errors.push(
      `The lead has ${lead.sentences.length} sentences; the limit is ${Math.min(ABOUT_MAX_LEAD_SENTENCES, shown.size)}.`,
    );
  }
  if (sentences.length > shown.size) {
    errors.push(
      `The prose has ${sentences.length} sentences for ${shown.size} shown facts.`,
    );
  }

  for (const { section, sentence } of sentences) {
    const where = `"${sentence.text.slice(0, 60)}" (${section.key})`;
    if (!sentence.factIds.length) {
      errors.push(`${where} cites no facts.`);
      continue;
    }
    const missing = sentence.factIds.filter((id) => !shown.has(id));
    if (missing.length) {
      errors.push(
        `${where} cites facts that are not shown: ${missing.join(", ")}.`,
      );
      continue;
    }
    const cited = sentence.factIds
      .map((id) => factText.get(id) ?? "")
      .join(" ");
    for (const number of stripThousands(sentence.text).match(NUMBER_PATTERN) ??
      []) {
      if (!containsNumber(cited, number)) {
        errors.push(`${where} states ${number}, which its facts do not.`);
      }
    }
    const words = sentence.text.split(/\s+/).filter(Boolean).length;
    if (words > ABOUT_MAX_SENTENCE_WORDS) {
      errors.push(
        `${where} has ${words} words; the limit is ${ABOUT_MAX_SENTENCE_WORDS}.`,
      );
    }
    for (const phrase of findBannedPhrases(sentence.text)) {
      errors.push(`${where} uses the banned phrase "${phrase}".`);
    }
  }

  return errors;
}

/**
 * When sources disagree, the stored value must be one the sources state.
 * Dates may be stated more precisely than they are stored, so a stored year
 * matches a stated full date in that year.
 */
export function checkConflictPicks(document: EntityAboutDocument) {
  const errors: string[] = [];
  for (const event of document.events) {
    const disagreement = getDisagreement(event.citations);
    if (!disagreement) continue;
    const matches = disagreement.values.some(
      ({ value }) =>
        value.startsWith(event.date) || event.date.startsWith(value),
    );
    if (!matches) {
      errors.push(
        `Event ${event.id} stores ${event.date}, which no source states.`,
      );
    }
  }
  for (const field of ABOUT_FACT_FIELD_LIST) {
    const fact = document.siteFacts[field];
    // Text facts are worded differently by each source; only numbers conflict.
    if (ABOUT_FACT_FIELDS[field].type !== "number") continue;
    const disagreement = fact ? getDisagreement(fact.citations) : null;
    if (!fact || !disagreement) continue;
    const stored = stripThousands(String(fact.value)).toLowerCase();
    const matches = disagreement.values.some(({ value }) =>
      stripThousands(value).toLowerCase().includes(stored),
    );
    if (!matches) {
      errors.push(
        `Site fact ${field} stores ${fact.value}, which no source states.`,
      );
    }
  }
  return errors;
}

/**
 * Runs every check on a pipeline draft. Returns the draft with unverified
 * citations removed, and the reasons it cannot be saved.
 */
export function reviewAboutDraft(
  draft: EntityAboutDocument,
  pages: readonly AboutPageRead[],
) {
  const document = keepVerifiedCitations(draft, pages);
  return {
    document,
    errors: [...checkAboutProse(document), ...checkConflictPicks(document)],
  };
}
