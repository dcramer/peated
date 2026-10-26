import type { EntityKind } from "@peated/server/db/schema";

export const ABOUT_FACT_FIELD_LIST = [
  "washStills",
  "spiritStills",
  "otherStills",
  "capacityLitres",
  "waterSource",
  "heating",
  "listing",
  "malting",
  "peating",
  "washbacks",
  "washbackMaterial",
  "fermentation",
  "distillation",
  "stillDesign",
  "condensers",
  "spiritCharacter",
] as const;

export type AboutFactField = (typeof ABOUT_FACT_FIELD_LIST)[number];

/**
 * Site facts an About document may hold. Adding a fact is one entry in each list;
 * the document schema is built from them. Removing or renaming an entry
 * breaks stored documents, so follow the About schema rule in
 * `schemas/entityAbout.ts`.
 */
export const ABOUT_FACT_FIELDS = {
  washStills: {
    label: "Wash stills",
    description: "Stills for the first distillation",
    type: "number",
    unit: null,
    kinds: ["distillery"],
  },
  spiritStills: {
    label: "Spirit stills",
    description: "Stills for the second distillation",
    type: "number",
    unit: null,
    kinds: ["distillery"],
  },
  otherStills: {
    label: "Other stills",
    description:
      "Stills of other kinds, such as a third still or a column still",
    type: "number",
    unit: null,
    kinds: ["distillery"],
  },
  capacityLitres: {
    label: "Capacity",
    description: "How much spirit it can make a year",
    type: "number",
    unit: "litres of alcohol a year",
    kinds: ["distillery"],
  },
  waterSource: {
    label: "Water",
    description: "The water it uses, such as a burn, spring, or loch",
    type: "text",
    unit: null,
    kinds: ["distillery"],
  },
  heating: {
    label: "Still heating",
    description: "How the stills are heated, such as steam or direct fire",
    type: "text",
    unit: null,
    kinds: ["distillery"],
  },
  listing: {
    label: "Listed building",
    description: "Its listed building status, such as Category B",
    type: "text",
    unit: null,
    kinds: ["distillery"],
  },
  malting: {
    label: "Malting",
    description: "Where its malt comes from, such as its own floor maltings",
    type: "text",
    unit: null,
    kinds: ["distillery"],
  },
  peating: {
    label: "Peating",
    description: "How peated its malt is, such as unpeated or a ppm level",
    type: "text",
    unit: null,
    kinds: ["distillery"],
  },
  washbacks: {
    label: "Washbacks",
    description: "How many fermentation vessels it has",
    type: "number",
    unit: null,
    kinds: ["distillery"],
  },
  washbackMaterial: {
    label: "Washbacks made of",
    description:
      "What the washbacks are made of, such as Oregon pine or stainless steel",
    type: "text",
    unit: null,
    kinds: ["distillery"],
  },
  fermentation: {
    label: "Fermentation",
    description: "How long fermentation lasts, such as 55 hours",
    type: "text",
    unit: null,
    kinds: ["distillery"],
  },
  distillation: {
    label: "Distillation",
    description:
      "How many times the spirit is distilled, such as triple distilled",
    type: "text",
    unit: null,
    kinds: ["distillery"],
  },
  stillDesign: {
    label: "Still shape",
    description: "The shape of the stills, such as lamp glass or boil ball",
    type: "text",
    unit: null,
    kinds: ["distillery"],
  },
  condensers: {
    label: "Condensers",
    description:
      "How the still vapour is cooled, such as worm tubs or shell and tube",
    type: "text",
    unit: null,
    kinds: ["distillery"],
  },
  spiritCharacter: {
    label: "Spirit character",
    description:
      "A style word a source uses for the new spirit, such as waxy, not tasting notes",
    type: "text",
    unit: null,
    kinds: ["distillery"],
  },
} as const satisfies Record<
  AboutFactField,
  {
    label: string;
    /** What the field means, for the writer's prompt. */
    description: string;
    type: "number" | "text";
    unit: string | null;
    kinds: readonly EntityKind[];
  }
>;

export function aboutFactFieldAppliesTo(
  field: AboutFactField,
  kind: EntityKind,
) {
  return ABOUT_FACT_FIELDS[field].kinds.some((fieldKind) => fieldKind === kind);
}
