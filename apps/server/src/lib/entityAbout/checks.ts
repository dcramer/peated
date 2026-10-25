import type { EntityKind } from "@peated/server/db/schema";
import type {
  AboutCitation,
  AboutSection,
  EntityAboutDocument,
} from "@peated/server/schemas/entityAbout";

import {
  ABOUT_FACT_FIELD_LIST,
  ABOUT_FACT_FIELDS,
  aboutFactFieldAppliesTo,
} from "./aboutFactFields";
import { findBannedPhrases } from "./bannedPhrases";
import {
  eventFactId,
  getDateDisagreement,
  getDisagreement,
  getFactCitations,
  getShownFactIds,
  ISO_DATE_PATTERN,
  siteFactId,
  valuesAgree,
} from "./display";
import {
  findAboutWriteErrors,
  normalizeSourceUrl,
  pruneSources,
} from "./document";

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

const FILLER_WORDS = new Set(["and", "the", "for", "with"]);

/**
 * Whether the quotes state `value`: every number in it, and the whole phrase
 * or every word that carries meaning. A date needs only its year, because
 * pages write months and days many ways.
 */
function quotesState(quotes: readonly string[], value: string) {
  const checked = ISO_DATE_PATTERN.test(value) ? value.slice(0, 4) : value;
  const numbers = stripThousands(checked).match(NUMBER_PATTERN) ?? [];
  const numbersStated = numbers.every((number) =>
    quotes.some((quote) => containsNumber(quote, number)),
  );
  if (!numbersStated) return false;
  // "James Ainslie and his partner John Risk" states "James Ainslie and John
  // Risk". A value of only numbers, or only short words, needs its numbers
  // or the whole phrase.
  const text = normalizeForQuote(quotes.join(" "));
  const phrase = normalizeForQuote(checked);
  // Whole words only: "Campbell" does not state "Bell".
  if (` ${text} `.includes(` ${phrase} `)) return true;
  const words = phrase
    .split(" ")
    .filter(
      (word) =>
        word.length > 2 && !FILLER_WORDS.has(word) && !/^\p{N}+$/u.test(word),
    );
  if (!words.length) return numbers.length > 0;
  const quoted = new Set(text.split(" "));
  return words.every((word) => quoted.has(word));
}

/**
 * Link rule (owner: docs/features/entity-about.md): an event links an Entity
 * only by an ID that Entity search returned in this run, or one the current
 * page already has. Any other ID is cleared; the names stay.
 */
export function keepFoundEntityLinks(
  document: EntityAboutDocument,
  entitiesFound: readonly number[],
  current: EntityAboutDocument | null,
): EntityAboutDocument {
  const allowed = new Set([
    ...entitiesFound,
    ...(current?.events ?? []).flatMap((event) =>
      [event.newOwnerId, event.relatedEntityId].filter((id) => id !== null),
    ),
  ]);
  const keep = (id: number | null) =>
    id !== null && allowed.has(id) ? id : null;
  return {
    ...document,
    events: document.events.map((event) => ({
      ...event,
      newOwnerId: keep(event.newOwnerId),
      relatedEntityId: keep(event.relatedEntityId),
    })),
  };
}

/**
 * Evidence rule (owner: docs/features/entity-about.md): a citation stands
 * only when its quote appears on a page read in the same run, or is the same
 * quote from the same page as one the current page already has, and states
 * the citation's value. A fact stands only when a kept quote states its date
 * (or value): the model's own fields are never the evidence. Facts left
 * without citations are dropped, then unused sources.
 */
export function keepVerifiedCitations(
  draft: EntityAboutDocument,
  pages: readonly AboutPageRead[],
  current: EntityAboutDocument | null,
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

  // A dated article that reports something happening now states its
  // publication date, so that date counts as quoted, but only when its year
  // is on the page read or the current page has the same date for it; the
  // model's own date is not evidence.
  const currentPublished = new Set(
    (current?.sources ?? []).flatMap((source) =>
      source.publishedOn
        ? [`${normalizeSourceUrl(source.url)} ${source.publishedOn}`]
        : [],
    ),
  );
  const published = new Map<string, string>();
  for (const source of draft.sources) {
    const url = normalizeSourceUrl(source.url);
    const text = pageText.get(url);
    if (
      source.publishedOn &&
      ((text && containsNumber(text, source.publishedOn.slice(0, 4))) ||
        currentPublished.has(`${url} ${source.publishedOn}`))
    ) {
      published.set(source.id, source.publishedOn);
    }
  }
  const quotesOf = (citations: readonly AboutCitation[]) =>
    citations.flatMap((citation) => [
      ...(citation.quote ? [citation.quote] : []),
      published.get(citation.sourceId) ?? "",
    ]);

  const quoteKey = (url: string, quote: string) =>
    `${normalizeSourceUrl(url)} ${normalizeForQuote(quote)}`;
  const currentUrls = new Map(
    (current?.sources ?? []).map((source) => [source.id, source.url]),
  );
  const carried = new Set(
    [...(current ? getFactCitations(current).values() : [])].flatMap(
      (citations) =>
        citations.flatMap((citation) => {
          const url = currentUrls.get(citation.sourceId);
          return url && citation.quote ? [quoteKey(url, citation.quote)] : [];
        }),
    ),
  );

  const isVerified = (citation: AboutCitation) => {
    if (!citation.quote) return false;
    const url = sourceUrls.get(citation.sourceId);
    const text = url ? pageText.get(url) : undefined;
    const quote = normalizeForQuote(citation.quote);
    const found =
      Boolean(text && quote && ` ${text} `.includes(` ${quote} `)) ||
      Boolean(url && carried.has(`${url} ${quote}`));
    return (
      found &&
      (!citation.statedValue ||
        quotesState(quotesOf([citation]), citation.statedValue))
    );
  };
  const events = draft.events
    .map((event) => ({
      ...event,
      citations: event.citations.filter(isVerified),
    }))
    .filter((event) => {
      const quotes = quotesOf(event.citations);
      // Names are shown as facts too, so one quote must state each whole;
      // words from different quotes do not make a name.
      const named = (name: string | null) =>
        !name ||
        event.citations.some((citation) =>
          quotesState(quotesOf([citation]), name),
        );
      // Text and titles are the model's words, but any number in them,
      // written as digits or words, is a fact, so a quote must state it too.
      const numbersQuoted = (value: string | null) =>
        (
          stripThousands(writeNumberWords(value ?? "")).match(NUMBER_PATTERN) ??
          []
        ).every((number) =>
          quotes.some((quote) => containsNumber(quote, number)),
        );
      return (
        quotesState(quotes, event.date.slice(0, 4)) &&
        (!event.endDate || quotesState(quotes, event.endDate.slice(0, 4))) &&
        named(event.name) &&
        named(event.newOwnerName) &&
        numbersQuoted(event.text) &&
        numbersQuoted(event.title)
      );
    });

  const siteFacts: EntityAboutDocument["siteFacts"] = {};
  for (const field of ABOUT_FACT_FIELD_LIST) {
    const fact = draft.siteFacts[field];
    if (!fact) continue;
    const citations = fact.citations.filter(isVerified);
    const quotes = quotesOf(citations);
    if (quotesState(quotes, String(fact.value))) {
      // The date is optional, so one no quote states is dropped, not the fact.
      const asOf =
        fact.asOf && quotesState(quotes, fact.asOf.slice(0, 4))
          ? fact.asOf
          : null;
      siteFacts[field] = { ...fact, asOf, citations };
    }
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

// Histories shorten year ranges, so "1931-38" also states 1938. A later
// two-digit end is read in the same century; "1999-02" is left alone.
function expandYearRanges(value: string) {
  return value.replace(
    /\b(\d{2})(\d{2})([-–])(\d{2})\b/g,
    (range, century: string, start: string, dash: string, end: string) =>
      end > start ? `${century}${start}${dash}${century}${end}` : range,
  );
}

// Pages write small counts as words: "two wash stills" states 2. "One" is
// left out because pages use it in many other ways. A word inside a larger
// number, such as "twenty-two" or "twenty two", is not read.
const NUMBER_WORDS = [
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

function writeNumberWords(value: string) {
  return value.replace(
    new RegExp(
      `(?<!-|\\b(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\\s+)\\b(${NUMBER_WORDS.join("|")})\\b(?!-)`,
      "gi",
    ),
    (word) => String(NUMBER_WORDS.indexOf(word.toLowerCase()) + 2),
  );
}

// A whole number: 46 is not inside 46.5 or 146, but 1887 is in "c.1887".
function containsNumber(text: string, number: string) {
  return new RegExp(
    `(?<!\\d|\\d\\.)${number.replace(".", "\\.")}(?!\\d|\\.\\d)`,
  ).test(stripThousands(expandYearRanges(writeNumberWords(text))));
}

/**
 * Checks prose against the facts it cites. Each check compares exact
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
    errors.push(...checkSentence(section, sentence, shown, factText));
  }

  return errors;
}

function checkSentence(
  section: AboutSection,
  sentence: AboutSection["sentences"][number],
  shown: ReadonlySet<string>,
  factText: ReadonlyMap<string, string>,
) {
  const where = `"${sentence.text.slice(0, 60)}" (${section.key})`;
  if (!sentence.factIds.length) return [`${where} cites no facts.`];
  const missing = sentence.factIds.filter((id) => !shown.has(id));
  if (missing.length) {
    return [`${where} cites facts that are not shown: ${missing.join(", ")}.`];
  }
  const errors: string[] = [];
  const cited = sentence.factIds.map((id) => factText.get(id) ?? "").join(" ");
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
    const disagreement = getDateDisagreement(event.citations);
    if (!disagreement) continue;
    const stored = event.endDate
      ? `${event.date}–${event.endDate}`
      : event.date;
    const matches = disagreement.values.some(({ value }) =>
      valuesAgree(value, stored),
    );
    if (!matches) {
      errors.push(
        `Event ${event.id} stores ${stored}, which no source states.`,
      );
    }
  }
  for (const field of ABOUT_FACT_FIELD_LIST) {
    const fact = document.siteFacts[field];
    // Text facts are worded differently by each source; only numbers conflict.
    if (ABOUT_FACT_FIELDS[field].type !== "number") continue;
    const disagreement = fact ? getDisagreement(fact.citations) : null;
    if (!fact || !disagreement) continue;
    const stored = stripThousands(String(fact.value));
    const matches = disagreement.values.some(({ value }) =>
      containsNumber(value, stored),
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
 * citations removed and site facts that do not apply to the Entity's kind
 * dropped, and the reasons it cannot be saved. The save rules run here too,
 * so a draft the store would reject gets its retry instead.
 */
export function reviewAboutDraft(
  draft: EntityAboutDocument,
  pages: readonly AboutPageRead[],
  kind: EntityKind,
  current: EntityAboutDocument | null,
) {
  const verified = keepVerifiedCitations(draft, pages, current);
  const siteFacts: EntityAboutDocument["siteFacts"] = {};
  for (const field of ABOUT_FACT_FIELD_LIST) {
    const fact = verified.siteFacts[field];
    if (fact && aboutFactFieldAppliesTo(field, kind)) siteFacts[field] = fact;
  }
  const document = pruneSources({ ...verified, siteFacts });
  const errors = [
    ...checkAboutProse(document),
    ...checkConflictPicks(document),
  ];
  if (!getShownFactIds(document).size) {
    errors.push("The draft has no facts with a source.");
  }
  // The save rules repeat some checks above, so they run last to keep each
  // reason listed once.
  if (!errors.length) errors.push(...findAboutWriteErrors(document));
  return { document, errors };
}
