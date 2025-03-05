import config from "@peated/server/config";
import {
  DEFAULT_CREATED_BY_ID,
} from "@peated/server/constants";
import { db } from "@peated/server/db";
import type { Bottle } from "@peated/server/db/schema";
import { bottles, changes } from "@peated/server/db/schema";
import { arraysEqual, objectsShallowEqual } from "@peated/server/lib/equals";
import { logError } from "@peated/server/lib/log";
import { getStructuredResponse } from "@peated/server/lib/openai";
import { startSpan } from "@sentry/node";
import { eq } from "drizzle-orm";
import { z } from "zod";

if (!config.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not configured.");
}
const SYSTEM_PROMPT = `
You are a data extraction assistant with expertise in whiskey labeling conventions. Extract the whiskey details from the given label description and output them in **JSON** format with the specified fields.

The fields to extract are:
- **brand**: The brand or bottler of the whiskey.
- **distillery**: An **array** of distilleries where the whiskey was produced (e.g., \`[ "Macallan", "Highland Park" ]\` for a blend of multiple distilleries, or \`[ "Lagavulin" ]\` for a single distillery release). If the whiskey is an **official bottling** from a single distillery, return \`[ distillery_name ]\`. If it’s a blend with unknown distilleries, return \`[]\` (empty array). If it is an independent bottling, return the distillery name(s) in the array.
- **expression**: The specific name or expression of the whiskey.
- **series**: The series or collection name (if applicable, otherwise \`null\`).
- **stated_age**: Age of the whiskey in years (integer, \`null\` if no age statement).
- **abv**: Alcohol by volume as a percentage (float, e.g., 43.0 for 43% ABV).
- **release_year**: The year the whiskey was released (if given, otherwise \`null\`).
- **vintage_year**: The distillation or vintage year (if given, otherwise \`null\`).
- **cask_type**: Primary cask type or finish (if mentioned, otherwise \`null\`).
- **edition**: Batch, edition, or release identifier (if mentioned, otherwise \`null\`).

---

### **Normalization Guidelines:**

1. **Brand vs Distillery:**
   - If the whiskey is an official distillery bottling, **brand** is the distillery name, and **distillery** is an array containing the same name (e.g., \`"brand": "Macallan"\,\` \`"distillery": [ "Macallan" ]\`).
   - If the whiskey is a **blend** from multiple distilleries, **distillery** should list all known contributing distilleries (e.g., \`[ "Macallan", "Highland Park" ]\`).
   - If the distilleries are **unknown**, set \`distillery: []\` (empty array).
   - If the whiskey is an **independent bottling**, set **brand** to the bottler name (e.g., \`"Gordon & MacPhail"\` ) and **distillery** to the actual producer(s) (e.g., \`[ "Caol Ila" ]\` for a Gordon & MacPhail Caol Ila release).

2. **Age Statement Handling:**
   - If the label includes a stated age (e.g., \`"12 Years Old"\`), extract it as an integer (\`stated_age: 12\`).
   - If there is no age statement, return \`null\` (\`stated_age: null\` for NAS – No Age Statement).

3. **ABV Extraction:**
   - Identify the ABV percentage and return it as a decimal (e.g., \`"abv": 46.3\` for \`"46.3% ABV"\`).

4. **Series and Edition Identification:**
   - If the whiskey is part of a named series (e.g., \`"Committee Release"\,\` \`"Limited Edition"\`), extract that into \`series\`.
   - If the label specifies an edition (e.g., \`"Batch 3"\,\` \`"2021 Release"\`), extract it into \`edition\`.

5. **Cask Type Extraction:**
   - If a maturation or finishing cask is mentioned (e.g., \`"Sherry Cask"\,\` \`"Bourbon Barrel"\`), include that in \`cask_type\`.

6. **Multiple Distilleries (Blends):**
   - If the label indicates that the whiskey is a **blend** of multiple distilleries, list all known names in \`distillery: [ "Distillery1", "Distillery2" ]\`.
   - If the distilleries are unspecified, leave \`distillery: []\` (empty array) instead of guessing.
   - If it's a **single malt**, ensure that **distillery** is an array with one value.

7. **Edge Case Handling:**
   - If a typo or near match is detected (e.g., "Ardbeg Supanova" instead of "Ardbeg Supernova"), correct it.
   - If a year is present but unclear (e.g., "2019" without context), use judgment but do **not fabricate details**.
   - If multiple dates are listed (e.g., "Distilled in 1998, Bottled in 2018"), use **vintage_year: 1998**, **release_year: 2018**.

---

### **Output Format**
The final output must be a **valid JSON object** with:
- \`null\` for missing values.
- An **array for distillery**, which may contain one or multiple entries, or be empty (\`[]\` for unknown blends).
- **No additional commentary**—output only the JSON object.

---

### **Example Outputs**

#### **Single Distillery Release**
Input:
> **"Macallan Sherry Oak 18 Year - ABV 43% - Aged in Oloroso Sherry Casks - 700ml"**

Output:
\`\`\`json
{
  "brand": "Macallan",
  "distillery": ["Macallan"],
  "expression": "Sherry Oak",
  "series": null,
  "stated_age": 18,
  "abv": 43.0,
  "release_year": null,
  "vintage_year": null,
  "cask_type": "Oloroso Sherry",
  "edition": null,
}
\`\`\`
`;


function generatePrompt(bottle: Bottle) {
  return SYSTEM_PROMPT;
}

const OpenAIBottleDetailsSchema = z.object({
  brand: z.string().nullish(),
  distillery: z.array(z.string()).nullish(),
  expression: z.string().nullish(),
  series: z.string().nullish(),
  stated_age: z.number().nullish(),
  abv: z.number().nullish(),
  release_year: z.number().nullish(),
  vintage_year: z.number().nullish(),
  cask_type: z.string().nullish(),
  edition: z.string().nullish(),
});


export type GeneratedBottleDetails = z.infer<typeof OpenAIBottleDetailsSchema>;

export async function getGeneratedBottleDetails(
  bottle: Partial<Bottle>,
): Promise<GeneratedBottleDetails | null> {
  return await startSpan(
    {
      op: "ai.pipeline",
      name: "generateBottleDetails",
    },
    async (span) => {
      return await getStructuredResponse(
        "generateBottleDetails",
        generatePrompt(bottle),
        OpenAIBottleDetailsSchema,
        OpenAIBottleDetailsSchema,
        undefined,
        {
          bottle: {
            id: bottle.id,
            fullName: bottle.fullName,
          },
        },
      );
    },
  );
}

export default async function ({ bottleId }: { bottleId: number }) {
  if (!config.OPENAI_API_KEY) {
    return;
  }

  const bottle = await db.query.bottles.findFirst({
    where: (bottles, { eq }) => eq(bottles.id, bottleId),
  });
  if (!bottle) {
    throw new Error(`Unknown bottle: ${bottleId}`);
  }

  const generateDesc =
    !bottle.descriptionSrc || bottle.descriptionSrc === "generated";

  // test if we need to run at all
  if (
    !generateDesc &&
    bottle.tastingNotes &&
    bottle.suggestedTags &&
    bottle.category &&
    bottle.flavorProfile
  ) {
    return;
  }

  const tagList = (await db.query.tags.findMany()).map((r) => r.name);
  const result = await getGeneratedBottleDetails(bottle, tagList);

  if (!result) {
    throw new Error(`Failed to generate details for bottle: ${bottleId}`);
  }

  const data: Record<string, any> = {};

  if (
    generateDesc &&
    result.description &&
    result.description !== bottle.description
  ) {
    data.description = result.description;
    data.descriptionSrc = "generated";
  }

  if (
    result.tastingNotes &&
    (!bottle.tastingNotes ||
      !objectsShallowEqual(result.tastingNotes, bottle.tastingNotes))
  ) {
    data.tastingNotes = result.tastingNotes;
  }

  if (
    result.suggestedTags?.length &&
    !arraysEqual(result.suggestedTags, bottle.suggestedTags)
  ) {
    if (!result.suggestedTags.find((t) => !tagList.includes(t))) {
      data.suggestedTags = result.suggestedTags;
    } else {
      logError(`Invalid value for suggestedTags`, {
        tag: {
          values: result.suggestedTags.filter((t) => !tagList.includes(t)),
        },
        bottle: {
          id: bottle.id,
          fullName: bottle.fullName,
        },
      });
    }
  }

  if (
    !bottle.category &&
    result.category &&
    result.category !== bottle.category
  ) {
    data.category = result.category;
  }

  if (
    !bottle.flavorProfile &&
    result.flavorProfile &&
    result.flavorProfile !== bottle.flavorProfile
  ) {
    data.flavorProfile = result.flavorProfile;
  }

  if (Object.keys(data).length === 0) return;

  await db.transaction(async (tx) => {
    await tx.update(bottles).set(data).where(eq(bottles.id, bottle.id));

    await tx.insert(changes).values({
      objectType: "bottle",
      objectId: bottle.id,
      displayName: bottle.fullName,
      createdById: DEFAULT_CREATED_BY_ID,
      type: "update",
      data: {
        ...data,
      },
    });
  });
}



