import {
  ENTITY_ABOUT_EVENT_KIND_LIST,
  ENTITY_ABOUT_SOURCE_KIND_LIST,
} from "@peated/server/constants";
import {
  ABOUT_FACT_FIELD_LIST,
  ABOUT_FACT_FIELDS,
} from "@peated/server/lib/entityAbout/aboutFactFields";
import { z } from "zod";

import { EntityKindEnum } from "./common";
import { EntityEventDateSchema } from "./entityEvents";

// About schema rule (owner: docs/features/entity-about.md): every Entity's
// About document is stored in this shape. Change it rarely and only in
// backward-compatible ways: add optional fields; never rename or remove a
// field or change what it means. Every stored document must still parse after
// a change. A breaking change needs a schema version bump, an upgrade that
// runs on read, and a checked migration of stored documents. The public About
// response follows the same rule.
export const ENTITY_ABOUT_SCHEMA_VERSION = 1;

export const AboutSourceKindEnum = z
  .enum(ENTITY_ABOUT_SOURCE_KIND_LIST)
  .describe(
    "`official` is the producer, government, or heritage records; `reference` is histories and encyclopedias; `press` is news and trade press; `retailer` is shops, auctions, and forums.",
  );

export const AboutEventKindEnum = z.enum(ENTITY_ABOUT_EVENT_KIND_LIST);

export const AboutWrittenByEnum = z
  .enum(["person", "pipeline"])
  .describe(
    "Who last wrote this item. The pipeline never changes `person` items.",
  );

export const AboutSourceIdSchema = z.string().trim().min(1).max(40);

/** A fact ID is `event:<id>` or `site:<field>`. */
export const AboutFactIdSchema = z
  .string()
  .regex(/^(?:event:\d+|site:[A-Za-z]+)$/, "Use event:<id> or site:<field>.");

export const AboutSourceSchema = z.object({
  id: AboutSourceIdSchema,
  url: z.string().url(),
  title: z.string().trim().min(1).max(300),
  publisher: z.string().trim().min(1).max(200).nullable().default(null),
  publishedOn: EntityEventDateSchema.nullable().default(null),
  kind: AboutSourceKindEnum,
  status: z.enum(["available", "unavailable"]).default("available"),
});

export const AboutCitationSchema = z.object({
  sourceId: AboutSourceIdSchema,
  statedValue: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .nullable()
    .default(null)
    .describe("The value this source states, such as a year or a number."),
  quote: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .default(null)
    .describe("Supporting passage. Private; never returned publicly."),
});

const AboutEventFields = z.object({
  id: z.number().int().positive(),
  kind: AboutEventKindEnum,
  date: EntityEventDateSchema,
  endDate: EntityEventDateSchema.nullable().default(null),
  continuing: z.boolean().default(false),
  name: z.string().trim().min(1).max(200).nullable().default(null),
  title: z.string().trim().min(1).max(200).nullable().default(null),
  text: z.string().trim().min(1).max(1000).nullable().default(null),
  relatedEntityId: z.number().int().positive().nullable().default(null),
  newOwnerId: z.number().int().positive().nullable().default(null),
  newOwnerName: z.string().trim().min(1).max(200).nullable().default(null),
  // The `entity_event` row this item was copied from, so the backfill copies
  // each row once. Dropped with `entity_event`.
  legacyEventId: z.number().int().positive().nullable().default(null),
  citations: z.array(AboutCitationSchema).default([]),
  writtenBy: AboutWrittenByEnum,
  createdAt: z.string().datetime().nullable().default(null),
  updatedAt: z.string().datetime().nullable().default(null),
});

export const AboutEventSchema = AboutEventFields.superRefine(
  (event, context) => {
    const issue = (path: string, message: string) =>
      context.addIssue({ code: "custom", path: [path], message });

    if (event.kind === "generic" && !event.text) {
      issue("text", "A generic event needs text.");
    }
    if (event.kind === "renamed" && !event.name) {
      issue("name", "A renamed event needs the new name.");
    }
    if (event.kind === "era") {
      if (!event.title) issue("title", "An era needs a title.");
      if (!event.endDate && !event.continuing) {
        issue("endDate", "An era needs an end date or must be continuing.");
      }
    }
    if (event.kind === "acquired" && !event.newOwnerId && !event.newOwnerName) {
      issue("newOwnerId", "An acquisition needs the new owner.");
    }
    if (event.kind !== "acquired" && (event.newOwnerId || event.newOwnerName)) {
      issue("newOwnerId", "Only an acquisition has a new owner.");
    }
    if (event.endDate && event.endDate < event.date) {
      issue("endDate", "The end date is before the start date.");
    }
  },
);

const AboutSiteFactSchema = z.object({
  value: z.union([z.number(), z.string().trim().min(1).max(200)]),
  asOf: EntityEventDateSchema.nullable().default(null),
  citations: z.array(AboutCitationSchema).default([]),
  writtenBy: AboutWrittenByEnum,
});

// Built from the field list. Each value must match its field's type.
export const AboutSiteFactsSchema = z
  .partialRecord(z.enum(ABOUT_FACT_FIELD_LIST), AboutSiteFactSchema)
  .superRefine((facts, context) => {
    for (const field of ABOUT_FACT_FIELD_LIST) {
      const fact = facts[field];
      if (!fact) continue;
      const number = ABOUT_FACT_FIELDS[field].type === "number";
      const valueSchema = number
        ? z.number().nonnegative()
        : z.string().trim().min(1).max(200);
      if (!valueSchema.safeParse(fact.value).success) {
        context.addIssue({
          code: "custom",
          path: [field, "value"],
          message: `${field} needs a ${number ? "number" : "text"} value.`,
        });
      }
    }
  });

export const AboutSentenceSchema = z.object({
  text: z.string().trim().min(1).max(400),
  factIds: z.array(AboutFactIdSchema).default([]),
});

export const AboutSectionSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/, "Use a short lowercase key."),
  heading: z.string().trim().min(1).max(120).nullable().default(null),
  eraEventId: z.number().int().positive().nullable().default(null),
  sentences: z.array(AboutSentenceSchema).min(1),
  writtenBy: AboutWrittenByEnum,
});

export const EntityAboutDocumentSchema = z.object({
  sources: z.array(AboutSourceSchema).default([]),
  events: z.array(AboutEventSchema).default([]),
  siteFacts: AboutSiteFactsSchema.default({}),
  sections: z.array(AboutSectionSchema).default([]),
});

export type AboutSource = z.infer<typeof AboutSourceSchema>;
export type AboutCitation = z.infer<typeof AboutCitationSchema>;
export type AboutEvent = z.infer<typeof AboutEventSchema>;
export type AboutSiteFact = z.infer<typeof AboutSiteFactSchema>;
export type AboutSection = z.infer<typeof AboutSectionSchema>;
export type EntityAboutDocument = z.infer<typeof EntityAboutDocumentSchema>;

// Public responses leave out quotes and pipeline bookkeeping.

export const AboutPublicCitationSchema = z.object({
  sourceId: AboutSourceIdSchema,
  statedValue: z.string().nullable(),
});

export const AboutDisagreementSchema = z.object({
  values: z
    .array(
      z.object({
        value: z.string(),
        sourceIds: z.array(AboutSourceIdSchema),
      }),
    )
    .describe("Every value the sources state, when they disagree."),
});

const AboutLinkedEntitySchema = z.object({
  id: z.number(),
  name: z.string(),
  kind: EntityKindEnum,
});

export const AboutPublicEventSchema = z.object({
  id: z.number(),
  kind: AboutEventKindEnum,
  date: z.string(),
  endDate: z.string().nullable(),
  continuing: z.boolean(),
  name: z.string().nullable(),
  title: z.string().nullable(),
  text: z.string().nullable(),
  relatedEntity: AboutLinkedEntitySchema.nullable(),
  newOwner: AboutLinkedEntitySchema.nullable(),
  newOwnerName: z.string().nullable(),
  citations: z.array(AboutPublicCitationSchema),
  disagreement: AboutDisagreementSchema.nullable(),
});

export const AboutPublicSiteFactSchema = z.object({
  field: z.string(),
  label: z.string(),
  value: z.union([z.number(), z.string()]),
  unit: z.string().nullable(),
  asOf: z.string().nullable(),
  citations: z.array(AboutPublicCitationSchema),
  disagreement: AboutDisagreementSchema.nullable(),
});

export const AboutPublicSectionSchema = z.object({
  key: z.string(),
  heading: z.string().nullable(),
  eraEventId: z.number().nullable(),
  sentences: z.array(
    z.object({
      text: z.string(),
      sourceIds: z.array(AboutSourceIdSchema),
      factIds: z
        .array(z.string())
        .describe("`event:<id>` or `site:<field>` for each fact stated."),
    }),
  ),
});

export const EntityAboutSchema = z.object({
  entityId: z.number(),
  version: z.number(),
  checkedOn: z.string().nullable(),
  lead: AboutPublicSectionSchema.nullable(),
  sections: z.array(AboutPublicSectionSchema),
  events: z.array(AboutPublicEventSchema),
  siteFacts: z.array(AboutPublicSiteFactSchema),
  sources: z.array(AboutSourceSchema),
});

export type EntityAboutPublic = z.infer<typeof EntityAboutSchema>;

export const EntityYearCountsSchema = z.object({
  results: z
    .array(z.object({ year: z.number(), count: z.number() }))
    .describe("Active Bottles for each year, oldest first."),
  withoutYear: z
    .number()
    .describe("Active Bottles left out because they have no year."),
});

export const EntityRelatedCountsSchema = z.object({
  results: z
    .array(
      z.object({
        entity: AboutLinkedEntitySchema,
        count: z.number(),
      }),
    )
    .describe("Active Bottles for each related Entity, most first."),
  withoutEntity: z
    .number()
    .describe("Active Bottles with no related Entity in this role."),
});
