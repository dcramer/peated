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
  type AboutFactField,
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
// A key fact may get a second sentence that explains it.
export const ABOUT_MAX_SENTENCES_PER_FACT = 2;

/** A page the writer read during one run. */
export type AboutPageRead = { url: string; text: string };

function normalizeForQuote(value: string) {
  return (
    value
      .normalize("NFKC")
      // Records that run table cells together, as in "CategoryBDate
      // Added28/03/1996Supplementary", match a quote that spaces them out.
      .replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2")
      .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, "$1 $2")
      .replace(/(\p{L})(\p{N})/gu, "$1 $2")
      .replace(/(\p{N})(\p{L})/gu, "$1 $2")
      .toLowerCase()
      .replace(/[‘’“”]/g, "'")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
  );
}

const FILLER_WORDS = new Set(["and", "the", "for", "with"]);

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/**
 * Trims a date to the precision its quotes state. `quotesState` checks only
 * the year, so a month needs its name or a numeric date in one of the fact's
 * quotes, and a day needs its number beside that month. A timeline quote
 * often gives the month under a year heading, so the year may come from
 * another quote. A lowercase month name counts only beside a number, so
 * "it may close" does not state May.
 */
function trimToStatedPrecision(quotes: readonly string[], date: string) {
  const [year, month, day] = date.split("-");
  if (!month) return date;
  const name = MONTH_NAMES[Number(month) - 1];
  if (!name) return year!;
  const names = [
    name,
    name.slice(0, 3),
    ...(name === "september" ? ["sept"] : []),
  ];
  const monthWord = `(?:${names.join("|")})\\.?`;
  const titleMonth = `(?:${names.map((n) => n[0]!.toUpperCase() + n.slice(1)).join("|")})\\.?`;
  const m = `0?${Number(month)}`;
  // Pages often glue a word to a number, as in "Incorporated on11 November".
  const spaced = quotes.map((quote) =>
    quote.replace(/(\p{L})(\p{N})/gu, "$1 $2"),
  );
  // A quote that names another year is about another date, so its month or
  // day does not count; a timeline quote with no year can.
  const states = (pattern: string, flags = "i") =>
    spaced.some(
      (quote) =>
        new RegExp(pattern, flags).test(quote) &&
        (quote.includes(year!) || !/\b(?:1[5-9]|20)\d\d\b/.test(quote)),
    );
  // "1963-04" or "04/1963" names April; a short range such as "1963-4" does not.
  const mm = month!.padStart(2, "0");
  const numericMonth = `\\b${year}-${mm}\\b|\\b${m}/${year}\\b`;
  const monthByNumber = `\\b${monthWord}(?![a-z])\\s*,?\\s*\\d|\\d(?:st|nd|rd|th)?\\s+(?:of\\s+)?${monthWord}(?![a-z])`;
  if (
    !states(`${numericMonth}|${monthByNumber}`) &&
    !states(`\\b${titleMonth}(?![a-z])`, "")
  ) {
    return year!;
  }
  if (!day) return date;
  const d = `0?${Number(day)}(?:st|nd|rd|th)?`;
  const dayWithMonth = `\\b${d}\\s+(?:of\\s+)?${monthWord}(?![a-z])|\\b${monthWord}\\s+${d}\\b`;
  const numericDay = `\\b${year}[-/.]${m}[-/.]${d}\\b|\\b${d}[-/.]${m}[-/.]${year}\\b|\\b${m}[-/.]${d}[-/.]${year}\\b`;
  return states(`${dayWithMonth}|${numericDay}`) ? date : `${year}-${month}`;
}

/** Trims a single-date statedValue the same way; ranges and other values pass. */
function trimStatedValue(quotes: readonly string[], value: string | null) {
  // A short range such as "1931-38" is not a month.
  return value && /^\d{4}-(?:0[1-9]|1[0-2])(?:-\d{2})?$/.test(value)
    ? trimToStatedPrecision(quotes, value)
    : value;
}

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
  // Some pages lose the space between table cells, as heritage records print
  // "CategoryADate Added". A phrase of two or more words still counts there.
  if (
    phrase.includes(" ") &&
    text.replaceAll(" ", "").includes(phrase.replaceAll(" ", ""))
  ) {
    return true;
  }
  // A lone capital is a grade, as in "Category B", so it must be quoted too.
  const grades = new Set(
    (checked.match(/\b\p{Lu}\b/gu) ?? []).map((letter) => letter.toLowerCase()),
  );
  const words = phrase
    .split(" ")
    .filter(
      (word) =>
        grades.has(word) ||
        (word.length > 2 && !FILLER_WORDS.has(word) && !/^\p{N}+$/u.test(word)),
    );
  if (!words.length) return numbers.length > 0;
  // Units are written many ways: "160 hours" is stated by "160-hour" and
  // "100hrs" as well. Tables can run a name into a year, as "Diageo1997".
  const quoted = new Set(
    text
      .replace(/(\p{N})(\p{L})/gu, "$1 $2")
      .replace(/(\p{L})(\p{N})/gu, "$1 $2")
      .split(" ")
      .map((word) => UNIT_ABBREVIATIONS.get(word) ?? word),
  );
  return words.every(
    (word) =>
      quoted.has(word) ||
      quoted.has(word.replace(/s$/, "")) ||
      quoted.has(`${word}s`),
  );
}

const UNIT_ABBREVIATIONS = new Map([
  ["hr", "hour"],
  ["hrs", "hours"],
]);

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

  // `states` decides whether a quote states the citation's value; site facts
  // also accept a count of 1 written as a word.
  const verifiedBy =
    (states: (quotes: readonly string[], value: string) => boolean) =>
    (citation: AboutCitation) => {
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
          states(quotesOf([citation]), citation.statedValue))
      );
    };
  const isVerified = verifiedBy(quotesState);
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
        ...readClaimNumbers(value ?? "").filter(
          (number) => !quotes.some((quote) => statesClaimNumber(quote, number)),
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
    })
    .map((event) => {
      // A month or day no quote states is the model's own; keep the year.
      const quotes = quotesOf(event.citations);
      const date = trimToStatedPrecision(quotes, event.date);
      const endDate =
        event.endDate && trimToStatedPrecision(quotes, event.endDate);
      if (date !== event.date || endDate !== event.endDate) {
        dropped.push(
          `Event ${event.id} (${event.kind}) was trimmed to ${[date, endDate].filter(Boolean).join("–")}: no kept quote states its month or day.`,
        );
      }
      const citations = event.citations.map((citation) => ({
        ...citation,
        statedValue: trimStatedValue(
          quotesOf([citation]),
          citation.statedValue,
        ),
      }));
      return { ...event, date, endDate, citations };
    });

  const siteFacts: EntityAboutDocument["siteFacts"] = {};
  for (const field of ABOUT_FACT_FIELD_LIST) {
    const fact = draft.siteFacts[field];
    if (!fact) continue;
    const states = (quotes: readonly string[], value: string) =>
      quotesState(quotes, value) || statesSingle(quotes, field, value);
    const citations = fact.citations.filter(verifiedBy(states));
    const quotes = quotesOf(citations);
    if (states(quotes, String(fact.value))) {
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
  return (
    value
      .replace(/(\d),(?=\d{3}(?!\d))/g, "$1")
      // Other languages group with dots or spaces, as in "3.700.000" and
      // "3 700 000". Two or more groups keep "1.6" and "1975 200" apart.
      .replace(
        /(?<![\d.])\d{1,3}(?:[. \u00a0\u202f]\d{3}){2,}(?![\d.])/g,
        (number) => number.replace(/[. \u00a0\u202f]/g, ""),
      )
      // A sum such as "\u00a31,274,684.00" states 1274684.
      .replace(/(\d)\.0{1,2}(?!\d)/g, "$1")
  );
}

// Histories shorten year ranges, so "1931-38" also states 1938. A later
// two-digit end is read in the same century; "1999-02" is left alone.
// "1931-38", "1893/94", "1943 – 45", and "1963-4" span to 1938, 1894, 1945,
// and 1964. Each full end year is added after the text, which stays as
// written, so "2008 – 12 warehouses" still states 12. A number with a decimal
// or thousands part, as in "2008 – 12,000 cases", is not a year.
function expandYearRanges(value: string) {
  const years = [
    ...value.matchAll(/\b(\d{2})(\d{2}) ?[-–/] ?(\d{1,2})\b(?![.,]\d)/g),
  ].flatMap(([, century, start, end]) => {
    const last = end!.length === 1 ? `${start![0]}${end}` : end!;
    return last > start! ? [`${century}${last}`] : [];
  });
  return years.length ? `${value} ${years.join(" ")}` : value;
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

/**
 * Whether quotes state a count of 1 for a site fact, as "one wash still" or
 * "a single spirit still". "One" alone is not read as a number because pages
 * use it in many other ways, so it must come right before the field's own
 * first word.
 */
function statesSingle(
  quotes: readonly string[],
  field: AboutFactField,
  value: string,
) {
  if (value !== "1") return false;
  // "Other stills" counts stills: "a single still" states 1.
  const noun = ABOUT_FACT_FIELDS[field].label
    .toLowerCase()
    .replace(/^other /, "")
    .split(" ")[0]!;
  const singular = noun.replace(/s$/, "");
  const text = ` ${normalizeForQuote(quotes.join(" "))} `;
  // Whole words: "one washback" does not state 1 wash still. A name may sit
  // between, as in "one Carter Head still", but "one of the stills" does not
  // state 1.
  const named = new RegExp(
    ` (?:one|a single) (?:(?!of |the |\\d)\\S+ ){0,3}${singular} `,
  );
  return (
    ["one", "a single"].some((count) =>
      text.includes(` ${count} ${singular}s `),
    ) || named.test(text)
  );
}

/** The number a run of number words states, when it is one small word. */
function readNumberWords(run: string) {
  const index = SMALL_NUMBER_WORDS.indexOf(run.toLowerCase());
  return index === -1 ? null : String(index + 2);
}

function writeNumberWords(value: string) {
  // "two million" states 2 million, like "2 million".
  return value
    .replace(
      new RegExp(
        `\\b(${SMALL_NUMBER_WORDS.join("|")})\\s+(million|billion)\\b`,
        "gi",
      ),
      (_, word: string, unit: string) => `${readNumberWords(word)} ${unit}`,
    )
    .replace(NUMBER_WORD_RUN, (run) => readNumberWords(run) ?? run);
}

// Capacities and prices are often written in millions or billions: "1.6m
// litres" and "1.6 million litres" state 1600000, "£1.2bn" and "1.2 billion"
// state 1200000000, and "200k lpa" states 200000. A "k", "m" or "bn" must
// touch the number, so "1887 M." and "20 m" are not millions.
function expandLargeNumbers(value: string) {
  // "mlpa" or "mla" is million litres of (pure) alcohol: "4.8 mlpa", "6.5mla",
  // or a table label such as "Capacity (mlpa) 3.4", where an "i" info icon
  // may sit between.
  const millionLitres = (n: string) => String(Math.round(Number(n) * 1e6));
  return value
    .replace(/\(mlpa\)\s*(?:i\s+)?(\d+(?:\.\d+)?)/gi, (_, n: string) =>
      millionLitres(n),
    )
    .replace(/\b(\d+(?:\.\d+)?)\s*(?:mlpa|mla)\b/gi, (_, n: string) =>
      millionLitres(n),
    )
    .replace(
      /\b(\d+(?:\.\d+)?)(k|m|\s*million|bn|\s*billion)\b/gi,
      (_, n: string, unit: string) =>
        String(
          Math.round(
            Number(n) * (/b/i.test(unit) ? 1e9 : /k/i.test(unit) ? 1e3 : 1e6),
          ),
        ),
    );
}

// A decade such as "the 1930s" is stated by any year in it ("1931") or by
// the decade itself, so it is read as "1930s", not as the year 1930.
const DECADE = /\b(\d{3})0s\b/g;

/** The numbers our own text states, with decades kept as "1930s". */
function readClaimNumbers(value: string) {
  const decades = [...value.matchAll(DECADE)].map(([decade]) => decade);
  return [
    ...decades,
    ...readNumbers(writeNumberWords(value.replace(DECADE, ""))),
  ];
}

function statesClaimNumber(text: string, number: string) {
  const decade = /^(\d{3})0s$/.exec(number);
  if (!decade) return containsNumber(text, number);
  return new RegExp(`(?<!\\d)${decade[1]}\\d(?!\\d)`).test(text);
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
  if (sentences.length > shown.size * ABOUT_MAX_SENTENCES_PER_FACT) {
    errors.push(
      `The prose has ${sentences.length} sentences for ${shown.size} shown facts; the limit is ${shown.size * ABOUT_MAX_SENTENCES_PER_FACT}.`,
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
  // Numbers written as words count too, as in event text: "nine hours"
  // states 9.
  for (const number of readClaimNumbers(sentence.text)) {
    if (!statesClaimNumber(cited, number)) {
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
    shown.size * ABOUT_MAX_SENTENCES_PER_FACT;
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
