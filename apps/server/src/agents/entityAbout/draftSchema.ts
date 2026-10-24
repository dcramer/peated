import {
  ENTITY_ABOUT_EVENT_KIND_LIST,
  ENTITY_ABOUT_SOURCE_KIND_LIST,
} from "@peated/server/constants";
import { ABOUT_FACT_FIELD_LIST } from "@peated/server/lib/entityAbout/aboutFactFields";
import {
  AboutEventSchema,
  AboutSectionSchema,
  AboutSiteFactsSchema,
  AboutSourceSchema,
  type EntityAboutDocument,
} from "@peated/server/schemas/entityAbout";
import { z } from "zod";

// The writer's output. Every field is required and nullable so the model
// returns one fixed shape; the job converts it to a stored document.

const DateSchema = z
  .string()
  .describe(
    "YYYY, YYYY-MM, or YYYY-MM-DD. Use only the precision the source gives.",
  );

const CitationSchema = z.object({
  sourceId: z.string().describe("The `id` of a source in `sources`."),
  statedValue: z
    .string()
    .nullable()
    .describe(
      "The value this source states for the fact: a date in the same format as `date`, or the number or text. Null when the source supports the fact without stating a value.",
    ),
  quote: z
    .string()
    .describe(
      "A passage copied exactly from the page text you read, at most 300 characters. It must contain the fact.",
    ),
});

export const AboutDraftSchema = z.object({
  sources: z.array(
    z.object({
      id: z.string().describe("Short ID such as `wp` or `official`."),
      url: z.string().describe("The exact URL you read."),
      title: z.string(),
      publisher: z.string().nullable(),
      publishedOn: DateSchema.nullable(),
      kind: z.enum(ENTITY_ABOUT_SOURCE_KIND_LIST),
    }),
  ),
  events: z.array(
    z.object({
      id: z.number().int().positive(),
      kind: z.enum(ENTITY_ABOUT_EVENT_KIND_LIST),
      date: DateSchema,
      endDate: DateSchema.nullable().describe("Only for an `era`."),
      continuing: z.boolean().describe("Only for an `era` that has not ended."),
      name: z
        .string()
        .nullable()
        .describe(
          "For `renamed`, the new name. For `opened`, the first name when it differs from today's.",
        ),
      title: z.string().nullable().describe("For an `era`, a short title."),
      text: z.string().nullable().describe("One plain sentence, or null."),
      newOwnerName: z
        .string()
        .nullable()
        .describe("For `acquired`, the new owner's name."),
      citations: z.array(CitationSchema),
    }),
  ),
  siteFacts: z.array(
    z.object({
      field: z.enum(ABOUT_FACT_FIELD_LIST),
      value: z.union([z.number(), z.string()]),
      asOf: DateSchema.nullable(),
      citations: z.array(CitationSchema),
    }),
  ),
  sections: z.array(
    z.object({
      key: z
        .string()
        .describe("`lead` for the opening, then short lowercase keys."),
      heading: z.string().nullable().describe("Null for the lead."),
      eraEventId: z.number().int().nullable(),
      sentences: z.array(
        z.object({
          text: z.string(),
          factIds: z
            .array(z.string())
            .describe(
              "`event:<id>` or `site:<field>` for every fact the sentence states.",
            ),
        }),
      ),
    }),
  ),
});

export type AboutDraft = z.infer<typeof AboutDraftSchema>;

/**
 * Converts the writer's draft into a stored document. Items the schema
 * rejects are dropped, not repaired, and each one becomes an error the
 * writer can fix on its retry.
 */
export function draftToDocument(draft: AboutDraft) {
  const errors: string[] = [];
  const reject = (item: string, error: z.ZodError) => {
    const issue = error.issues[0];
    const path = issue?.path.join(".");
    errors.push(
      `The ${item} does not match the output format${path ? ` at ${path}` : ""}: ${issue?.message ?? "invalid"}.`,
    );
  };

  const sources = draft.sources.flatMap((source) => {
    const parsed = AboutSourceSchema.safeParse({
      ...source,
      status: "available",
    });
    if (!parsed.success) reject(`source ${source.id}`, parsed.error);
    return parsed.success ? [parsed.data] : [];
  });

  const events = draft.events.flatMap((event) => {
    const parsed = AboutEventSchema.safeParse({
      ...event,
      relatedEntityId: null,
      newOwnerId: null,
    });
    if (!parsed.success) reject(`event ${event.id}`, parsed.error);
    return parsed.success ? [parsed.data] : [];
  });

  const siteFacts: EntityAboutDocument["siteFacts"] = {};
  for (const fact of draft.siteFacts) {
    const parsed = AboutSiteFactsSchema.safeParse({
      [fact.field]: {
        value: fact.value,
        asOf: fact.asOf,
        citations: fact.citations,
      },
    });
    if (parsed.success) Object.assign(siteFacts, parsed.data);
    else reject(`site fact ${fact.field}`, parsed.error);
  }

  const sections = draft.sections.flatMap((section) => {
    const parsed = AboutSectionSchema.safeParse(section);
    if (!parsed.success) reject(`section ${section.key}`, parsed.error);
    return parsed.success ? [parsed.data] : [];
  });

  const document: EntityAboutDocument = {
    sources,
    events,
    siteFacts,
    sections,
  };
  return { document, errors };
}

/**
 * A stored document in the writer's output format, so the writer can return
 * it with changes. Quotes are kept; a citation without one cannot be
 * carried and is left out.
 */
export function documentToDraft(document: EntityAboutDocument): AboutDraft {
  const citations = (
    list: EntityAboutDocument["events"][number]["citations"],
  ) =>
    list.flatMap((citation) =>
      citation.quote
        ? [
            {
              sourceId: citation.sourceId,
              statedValue: citation.statedValue,
              quote: citation.quote,
            },
          ]
        : [],
    );
  return {
    sources: document.sources.map(({ status: _status, ...source }) => source),
    events: document.events.map((event) => ({
      id: event.id,
      kind: event.kind,
      date: event.date,
      endDate: event.endDate,
      continuing: event.continuing,
      name: event.name,
      title: event.title,
      text: event.text,
      newOwnerName: event.newOwnerName,
      citations: citations(event.citations),
    })),
    siteFacts: ABOUT_FACT_FIELD_LIST.flatMap((field) => {
      const fact = document.siteFacts[field];
      return fact
        ? [
            {
              field,
              value: fact.value,
              asOf: fact.asOf,
              citations: citations(fact.citations),
            },
          ]
        : [];
    }),
    sections: document.sections.map((section) => ({
      key: section.key,
      heading: section.heading,
      eraEventId: section.eraEventId,
      sentences: section.sentences.map(({ text, factIds }) => ({
        text,
        factIds,
      })),
    })),
  };
}
