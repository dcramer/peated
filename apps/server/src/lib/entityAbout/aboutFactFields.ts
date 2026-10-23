import type { EntityKind } from "@peated/server/db/schema";

/**
 * Site facts an About document may hold. Adding a fact is one entry here; the
 * document schema is built from this list. Removing or renaming an entry
 * breaks stored documents, so follow the About schema rule in
 * `schemas/entityAbout.ts`.
 */
export const ABOUT_FACT_FIELDS = {
  washStills: {
    label: "Wash stills",
    type: "number",
    unit: null,
    kinds: ["distillery"],
  },
  spiritStills: {
    label: "Spirit stills",
    type: "number",
    unit: null,
    kinds: ["distillery"],
  },
  otherStills: {
    label: "Other stills",
    type: "number",
    unit: null,
    kinds: ["distillery"],
  },
  capacityLitres: {
    label: "Capacity",
    type: "number",
    unit: "litres of alcohol a year",
    kinds: ["distillery"],
  },
  waterSource: {
    label: "Water",
    type: "text",
    unit: null,
    kinds: ["distillery"],
  },
  heating: {
    label: "Still heating",
    type: "text",
    unit: null,
    kinds: ["distillery"],
  },
  listing: {
    label: "Listed building",
    type: "text",
    unit: null,
    kinds: ["distillery"],
  },
} as const satisfies Record<
  string,
  {
    label: string;
    type: "number" | "text";
    unit: string | null;
    kinds: readonly EntityKind[];
  }
>;

export type AboutFactField = keyof typeof ABOUT_FACT_FIELDS;

export const ABOUT_FACT_FIELD_LIST = Object.keys(
  ABOUT_FACT_FIELDS,
) as AboutFactField[];

export function aboutFactFieldAppliesTo(
  field: AboutFactField,
  kind: EntityKind,
) {
  return (ABOUT_FACT_FIELDS[field].kinds as readonly EntityKind[]).includes(
    kind,
  );
}
