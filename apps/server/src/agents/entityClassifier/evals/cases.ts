import type {
  EntityClassificationAdvice,
  EntityClassificationContext,
  EntityResolution,
} from "@peated/entity-classifier";
import { EntityClassificationContextSchema } from "@peated/entity-classifier";
import savedPages from "./pages.json";

export type SavedPage = (typeof savedPages)[number];

export type EntityEvalCase = {
  name: string;
  context: EntityClassificationContext;
  /** What `search_entities` finds for each kind. */
  localEntities: EntityResolution[];
  /** Pages the web tools can see. Every search returns these. */
  pages: SavedPage[];
  expected: {
    /** More than one kind only when the evidence fits each of them. */
    kinds: EntityClassificationAdvice["kind"][];
    targetEntityId?: number;
  };
  /** Where the expected answer comes from. */
  source: string;
};

const CLEANUP_RECORD = "docs/research/catalog/2026-10-30-entity-cleanup.md";
const ABOUT_BACKLOG = "About pages inventory, 2026-10-29";

const MANUAL_AUDIT = {
  kind: "manual_audit" as const,
  summary: "Manual audit requested for this entity.",
  details: null,
};

function genericName(name: string) {
  return {
    kind: "generic_name" as const,
    summary: "Entity name looks generic instead of producer-specific.",
    details: `${name} is composed entirely of generic whisky style words.`,
  };
}

function savedPage(url: string): SavedPage {
  const page = savedPages.find((saved) => saved.url === url);
  if (!page) throw new Error(`No saved page for ${url}`);
  return page;
}

function context(
  entity: Partial<EntityClassificationContext["entity"]> &
    Pick<EntityClassificationContext["entity"], "id" | "name" | "kind">,
  {
    reasons = [MANUAL_AUDIT],
    sampleBottles = [],
    candidateTargets = [],
  }: Partial<Omit<EntityClassificationContext, "entity">> = {},
): EntityClassificationContext {
  return EntityClassificationContextSchema.parse({
    entity,
    reasons,
    sampleBottles,
    candidateTargets,
  });
}

function bottle(id: number, fullName: string, category: string) {
  return { id, fullName, name: fullName, category, totalTastings: null };
}

function localEntity(
  entityId: number,
  name: string,
  kind: EntityResolution["kind"],
  shortName: string | null = null,
): EntityResolution {
  return {
    entityId,
    name,
    shortName,
    kind,
    reference: name,
    score: 1,
    source: ["text"],
  };
}

export const ENTITY_EVAL_CASES: EntityEvalCase[] = [
  {
    name: "a whisky style name with no Bottles is not a real Brand",
    context: context(
      {
        id: 1342,
        name: "Single Malt Scotch Whisky",
        kind: "brand",
        countryName: "Scotland",
      },
      { reasons: [genericName("Single Malt Scotch Whisky")] },
    ),
    localEntities: [],
    pages: [],
    expected: { kinds: ["generic_or_invalid"] },
    source: "Production Entity 1342: the name is a legal whisky category.",
  },
  {
    name: "a whisky style name filed as a bottler is not a real bottler",
    context: context(
      { id: 2298, name: "Blended Whisky", kind: "bottler" },
      { reasons: [genericName("Blended Whisky")] },
    ),
    localEntities: [],
    pages: [],
    expected: { kinds: ["generic_or_invalid"] },
    source: "Production Entity 2298: the name is a whisky style.",
  },
  {
    name: "a style name stays generic even with real Bottles attached",
    context: context(
      {
        id: 1341,
        name: "Single Malt Irish Whiskey",
        kind: "brand",
        countryName: "Ireland",
        totalBottles: 3,
      },
      {
        reasons: [genericName("Single Malt Irish Whiskey")],
        sampleBottles: [
          bottle(
            1871,
            "Single Malt Irish Whiskey 1991 RK Hotel Essener Hof",
            "single_malt",
          ),
          bottle(
            2594,
            "Single Malt Irish Whiskey 2001 RK Hotel Essener Hof",
            "single_malt",
          ),
        ],
      },
    ),
    localEntities: [],
    pages: [],
    expected: { kinds: ["generic_or_invalid"] },
    source: "Production Entity 1341: no producer is named on its Bottles.",
  },
  {
    name: "an empty copy of a company points at the full record",
    context: context({
      id: 366612,
      name: "John Dewar & Sons",
      kind: "company",
    }),
    localEntities: [localEntity(5554, "John Dewar & Sons Ltd.", "company")],
    pages: [],
    expected: { kinds: ["possible_duplicate"], targetEntityId: 5554 },
    source: `${ABOUT_BACKLOG}: 366612 is an empty record of 5554.`,
  },
  {
    name: "a short distillery name points at the full record",
    context: context(
      {
        id: 72306,
        name: "Cascade Hollow",
        kind: "distillery",
        totalBottles: 17,
      },
      {
        sampleBottles: [
          bottle(67131, "George Dickel 15-year-old Single Barrel", "bourbon"),
        ],
      },
    ),
    localEntities: [
      localEntity(
        1609,
        "Cascade Hollow Distillery",
        "distillery",
        "Cascade Hollow",
      ),
    ],
    pages: [savedPage("https://www.georgedickel.com/en-us/our-story")],
    expected: { kinds: ["possible_duplicate"], targetEntityId: 1609 },
    source: `${ABOUT_BACKLOG}: 72306 duplicates 1609, which has the page.`,
  },
  {
    name: "a product filed as a producer belongs to its real Brand",
    context: context(
      // The production row was deleted on 2026-10-30, and its ID is not on
      // record. This ID matches no Entity.
      { id: 999_001, name: "Velvet Fig", kind: "distillery", totalBottles: 2 },
      {
        reasons: [
          {
            kind: "brand_repair_group",
            summary: "Bottle evidence points at stronger existing brand rows.",
            details:
              "2 bottles currently support reassignment to Wemyss Malts.",
          },
        ],
        sampleBottles: [
          bottle(7001, "Wemyss Malts Velvet Fig 25-year-old", "blended_malt"),
          bottle(16447, "Wemyss Malts Velvet Fig", "blend"),
        ],
        candidateTargets: [
          {
            entityId: 5718,
            name: "Wemyss Malts",
            shortName: null,
            otherNames: [],
            kind: "brand",
            website: "https://wemyssfamilyspirits.com/",
            score: null,
            candidateCount: 2,
            totalTastings: 0,
            supportingBottleIds: [7001, 16447],
            reason: "2 bottles already match Wemyss Malts from bottle names.",
            source: ["grouped_brand_repair"],
          },
        ],
      },
    ),
    localEntities: [localEntity(5718, "Wemyss Malts", "brand")],
    pages: [
      savedPage(
        "https://whiskymag.com/articles/wemyss-malts-announces-return-of-velvet-fig/",
      ),
    ],
    expected: { kinds: ["brand_assignment_issue"], targetEntityId: 5718 },
    source: `${CLEANUP_RECORD}: Velvet Fig is a Wemyss Malts blended malt.`,
  },
  {
    name: "a company is not a duplicate of the distillery it created",
    context: context(
      {
        id: 365855,
        name: "Celtic Whisky Distillerie",
        kind: "company",
        website: "https://www.celtic-whisky-distillerie.fr/en/",
        countryName: "France",
        totalBottles: 2,
      },
      {
        sampleBottles: [
          bottle(
            45958,
            "Gwalarn Celtic Whisky Blend - 40.0% ABV - Bourbon Cask",
            "blend",
          ),
          bottle(55465, "Gwalarn Pure Malt", "blended_malt"),
        ],
      },
    ),
    localEntities: [localEntity(241, "Glann ar Mor", "distillery")],
    pages: [savedPage("https://en.wikipedia.org/wiki/Glann_ar_Mor_distillery")],
    expected: { kinds: ["no_issue"] },
    source: `${CLEANUP_RECORD}: the company owns the distillery.`,
  },
  {
    name: "two plants of one producer are not duplicates",
    context: context(
      {
        id: 366601,
        name: "Heaven Hill Bernheim Distillery",
        shortName: "Bernheim Distillery",
        kind: "distillery",
        website: "https://heavenhilldistillery.com/our-distilleries.php",
        countryName: "United States",
        regionName: "Kentucky",
        totalBottles: 65,
      },
      {
        sampleBottles: [
          bottle(13613, "Heaven Hill Bottled-in-Bond", "bourbon"),
        ],
      },
    ),
    localEntities: [
      localEntity(366600, "Heaven Hill Distillery", "distillery"),
    ],
    pages: [
      savedPage("https://drinksint.com/news/fullstory.php/aid/11940/.html"),
    ],
    expected: { kinds: ["no_issue"] },
    source: `${CLEANUP_RECORD}: Bernheim in Louisville is not the new plant.`,
  },
  {
    name: "a well-known distillery has no issue",
    context: context(
      {
        id: 1124,
        name: "Lagavulin",
        kind: "distillery",
        countryName: "Scotland",
        regionName: "Islay",
        totalBottles: 40,
      },
      {
        sampleBottles: [bottle(7, "Lagavulin 16-year-old", "single_malt")],
      },
    ),
    localEntities: [localEntity(1124, "Lagavulin", "distillery")],
    pages: [savedPage("https://en.wikipedia.org/wiki/Lagavulin_distillery")],
    expected: { kinds: ["no_issue"] },
    source: "Production Entity 1124, with the reviewed About page sources.",
  },
  {
    name: "a real bottler with a generic-sounding name has no issue",
    context: context(
      {
        id: 1317,
        name: "Scotch Universe",
        kind: "bottler",
        website: "https://www.scotch-universe.co.uk/",
        countryName: "Germany",
        totalBottles: 3,
      },
      {
        reasons: [genericName("Scotch Universe")],
        sampleBottles: [
          bottle(67641, "The Old Friends Glen Ord 2012", "single_malt"),
          bottle(67646, "Scotch Universe Ordoculus", "single_malt"),
        ],
      },
    ),
    localEntities: [localEntity(1317, "Scotch Universe", "bottler")],
    pages: [savedPage("https://www.scotch-universe.co.uk/")],
    expected: { kinds: ["no_issue"] },
    source: "Production Entity 1317: its own site sells these ranges.",
  },
  {
    name: "a distillery filed as a Brand has a metadata issue",
    context: context(
      {
        id: 1282,
        name: "Rampur",
        kind: "brand",
        website: "https://rampursinglemalt.com/",
        countryName: "India",
        totalBottles: 9,
      },
      {
        sampleBottles: [
          bottle(12879, "Rampur Asava", "single_malt"),
          bottle(13699, "Rampur Double Cask Single Malt", "single_malt"),
        ],
      },
    ),
    localEntities: [],
    pages: [savedPage("https://rampursinglemalt.com/")],
    expected: { kinds: ["metadata_issue"] },
    source: `${ABOUT_BACKLOG}: Rampur 1282 was changed to a distillery.`,
  },
  {
    name: "a row with no Bottles and no sources stays unresolved",
    context: context(
      {
        id: 3892,
        name: "Scotch Guard",
        kind: "brand",
        countryName: "Scotland",
      },
      { reasons: [genericName("Scotch Guard")] },
    ),
    localEntities: [],
    pages: [],
    expected: { kinds: ["insufficient_evidence", "generic_or_invalid"] },
    source: "Production Entity 3892: nothing names a producer.",
  },
];
