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
  parseDates,
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
 * or every word that carries meaning. A date, or each end of a date range,
 * needs only its year, because pages write months and days many ways.
 */
function quotesState(quotes: readonly string[], value: string) {
  const dates = parseDates(value);
  const checked = dates
    ? [dates.start, dates.end ?? ""].map((date) => date.slice(0, 4)).join(" ")
    : value;
  const numbers = readNumbers(checked);
  const numbersStated = numbers.every((number) =>
    quotes.some((quote) => containsNumber(quote, number)),
  );
  if (!numbersStated) return false;
  // "James Ainslie and his partner John Risk" states "James Ainslie and John
  // Risk". A value of only numbers, or only short words, needs its numbers
  // or the whole phrase.
  const text = normalizeForQuote(quotes.join(" "));
  // "1.6 million" is a number, not the word "million" a quote must repeat.
  const phrase = normalizeForQuote(expandLargeNumbers(stripThousands(checked)));
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
  return verifyCitations(draft, pages, current).document;
}

/** Like `keepVerifiedCitations`, and also says why each dropped fact went. */
function verifyCitations(
  draft: EntityAboutDocument,
  pages: readonly AboutPageRead[],
  current: EntityAboutDocument | null,
) {
  const dropped: string[] = [];
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
    .filter((event, index) => {
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
      // Number words the check cannot read must appear in a quote as written.
      const unquotedNumbers = (value: string | null) => [
        ...readNumbers(writeNumberWords(value ?? "")).filter(
          (number) => !quotes.some((quote) => containsNumber(quote, number)),
        ),
        ...(
          expandLargeNumbers(stripThousands(value ?? "")).match(
            NUMBER_WORD_RUN,
          ) ?? []
        )
          .filter((run) => !readNumberWords(run) && run.toLowerCase() !== "one")
          .filter(
            (run) =>
              !quotes.some((quote) =>
                ` ${normalizeForQuote(quote)} `.includes(
                  ` ${normalizeForQuote(run)} `,
                ),
              ),
          ),
      ];
      const year = (date: string) => date.slice(0, 4);
      const findMissing = () => {
        if (!event.citations.length) {
          return "none of its quotes is on a page read and states its statedValue";
        }
        if (!quotesState(quotes, year(event.date))) {
          return `no kept quote states its year ${year(event.date)}`;
        }
        if (event.endDate && !quotesState(quotes, year(event.endDate))) {
          return `no kept quote states its end year ${year(event.endDate)}`;
        }
        if (!named(event.name)) {
          return `no one kept quote states its name "${event.name}"`;
        }
        if (!named(event.newOwnerName)) {
          return `no one kept quote states its new owner "${event.newOwnerName}"`;
        }
        const unquoted = [
          ...unquotedNumbers(event.text),
          ...unquotedNumbers(event.title),
        ];
        if (unquoted.length) {
          return `its text or title states ${unquoted.join(", ")}, which no kept quote states`;
        }
        return null;
      };
      const missing = findMissing();
      if (missing) {
        // Name the quotes that failed too: often one of them held the
        // missing value.
        const failed = [
          ...new Set(
            draft.events[index]!.citations.filter(
              (citation) => !isVerified(citation),
            ).map((citation) => citation.sourceId),
          ),
        ];
        const failedNote = failed.length
          ? ` Its quotes from ${failed.join(", ")} did not pass: a quote must be on a page read and state its statedValue.`
          : "";
        dropped.push(
          `Event ${event.id} (${event.kind}, ${event.date}) was dropped: ${missing}.${failedNote}`,
        );
      }
      return !missing;
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
    } else {
      dropped.push(
        `Site fact ${field} was dropped: no kept quote states ${fact.value}.`,
      );
    }
  }

  return { document: pruneSources({ ...draft, events, siteFacts }), dropped };
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
  return value.replace(/(\d),(?=\d{3}(?!\d))/g, "$1");
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

// Pages write small counts as words: "two wash stills" states 2. Only a
// number written as one word from two to twelve is read; "one" is left out
// because pages use it in many other ways. A run of number words such as
// "twenty-two", "two hundred", or "three thousand" is a larger number and is
// not read. Hyphens and en dashes join a run; an em dash is punctuation, so
// "1983—four stills" states 4, and "twelve-year-old" states 12.
const SMALL_NUMBER_WORDS = [
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

const NUMBER_WORD = `(?:${[
  "zero",
  "one",
  ...SMALL_NUMBER_WORDS,
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
  "hundred",
  "thousand",
  "million",
  "billion",
].join("|")})`;

const NUMBER_WORD_RUN = new RegExp(
  `\\b${NUMBER_WORD}(?:(?:[-\\u2010\\u2011\\u2013]|\\s+(?:and\\s+)?)${NUMBER_WORD})*\\b`,
  "gi",
);

/** The number a run of number words states, when it is one small word. */
function readNumberWords(run: string) {
  const index = SMALL_NUMBER_WORDS.indexOf(run.toLowerCase());
  return index === -1 ? null : String(index + 2);
}

function writeNumberWords(value: string) {
  return value.replace(NUMBER_WORD_RUN, (run) => readNumberWords(run) ?? run);
}

// Capacities and prices are often written in millions or billions: "1.6m
// litres" and "1.6 million litres" state 1600000, "£1.2bn" and "1.2 billion"
// state 1200000000. An "m" or "bn" must touch the number, so "1887 M." and
// "20 m" are not millions.
function expandLargeNumbers(value: string) {
  return value.replace(
    /\b(\d+(?:\.\d+)?)(m|\s*million|bn|\s*billion)\b/gi,
    (_, n: string, unit: string) =>
      String(Math.round(Number(n) * (/b/i.test(unit) ? 1e9 : 1e6))),
  );
}

/** The numbers a value states, read the same way as quotes. */
function readNumbers(value: string) {
  return expandLargeNumbers(stripThousands(value)).match(NUMBER_PATTERN) ?? [];
}

// A whole number: 46 is not inside 46.5 or 146, but 1887 is in "c.1887".
// The number may match the text as written ("1.6" in "1.6m") or with
// millions and billions expanded ("1600000" in "1.6m").
function containsNumber(text: string, number: string) {
  const pattern = new RegExp(
    `(?<!\\d|\\d\\.)${number.replace(".", "\\.")}(?!\\d|\\.\\d)`,
  );
  const written = stripThousands(expandYearRanges(writeNumberWords(text)));
  return pattern.test(written) || pattern.test(expandLargeNumbers(written));
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
  for (const number of readNumbers(sentence.text)) {
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
 * Fits the prose to what the checks kept: leaves out sentences that cite a
 * dropped fact, then trims sentences from the end until the counts fit the
 * shown facts, dropping sections beyond the lead first. The job uses it only
 * on its last attempt (see docs/features/entity-about.md); every sentence
 * left still gets every check, and a page left without a lead is not saved.
 */
export function trimProseToShownFacts(
  document: EntityAboutDocument,
): EntityAboutDocument {
  const shown = getShownFactIds(document);
  let sections = document.sections
    .map((section) => ({
      ...section,
      sentences: section.sentences.filter((sentence) =>
        sentence.factIds.every((id) => shown.has(id)),
      ),
    }))
    .filter((section) => section.sentences.length);
  if (shown.size < ABOUT_MIN_FACTS_FOR_PROSE)
    return { ...document, sections: [] };
  if (shown.size < ABOUT_MIN_FACTS_FOR_SECTIONS) {
    sections = sections.filter((section) => section.key === "lead");
  }
  sections = sections.map((section) =>
    section.key === "lead"
      ? {
          ...section,
          sentences: section.sentences.slice(
            0,
            Math.min(ABOUT_MAX_LEAD_SENTENCES, shown.size),
          ),
        }
      : section,
  );
  // Trim from the last section beyond the lead; the lead goes last.
  let extra =
    sections.reduce((total, section) => total + section.sentences.length, 0) -
    shown.size;
  for (let i = sections.length - 1; i >= 0 && extra > 0; i -= 1) {
    const section = sections[i]!;
    const keep = Math.max(
      section.key === "lead" ? 1 : 0,
      section.sentences.length - extra,
    );
    extra -= section.sentences.length - keep;
    sections[i] = { ...section, sentences: section.sentences.slice(0, keep) };
  }
  return {
    ...document,
    sections: sections.filter((section) => section.sentences.length),
  };
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
  const { document: verified, dropped } = verifyCitations(
    draft,
    pages,
    current,
  );
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
  // Dropped facts are not errors: the page is saved without them. They tell
  // a retry what to fix.
  return { document, errors, dropped };
}
