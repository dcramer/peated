import config from "@peated/server/config";
import { CATEGORY_LIST } from "@peated/server/constants";
import { getStructuredResponse } from "@peated/server/lib/openai";
import { startSpan } from "@sentry/node";
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
- **category**: The category of the whiskey. One of \`blend\`, \`bourbon\`, \`rye\`, \`single_grain\`, \`single_malt\`, \`single_pot_still\`.
- **stated_age**: Age of the whiskey in years (integer, \`null\` if no age statement).
- **abv**: Alcohol by volume as a percentage (float, e.g., 43.0 for 43% ABV).
- **release_year**: The year the whiskey was released (if given, otherwise \`null\`).
- **vintage_year**: The distillation or vintage year (if given, otherwise \`null\`).
- **cask_type**: Primary cask type or finish (if mentioned, otherwise \`null\`).
- **edition**: Batch, edition, or release identifier (if mentioned, otherwise \`null\`).

---

### **Normalization Guidelines:**

1. **Brand vs Distillery:**
   - If the whiskey is an official distillery bottling, **brand** is the distillery name, and **distillery** is an array containing the same name (e.g., \`"brand": "Macallan",\` \`"distillery": [ "Macallan" ]\`).
   - If the whiskey is a **blend** from multiple distilleries, **distillery** should list all known contributing distilleries (e.g., \`[ "Macallan", "Highland Park" ]\`).
   - If the distilleries are **unknown**, set \`distillery: []\` (empty array).
   - If the whiskey is an **independent bottling**, set **brand** to the bottler name (e.g., \`"Gordon & MacPhail"\` ) and **distillery** to the actual producer(s) (e.g., \`[ "Caol Ila" ]\` for a Gordon & MacPhail Caol Ila release).

2. **Age Statement Handling:**
   - If the label includes a stated age (e.g., \`"12 Years Old"\`), extract it as an integer (\`stated_age: 12\`).
   - If there is no age statement, return \`null\` (\`stated_age: null\` for NAS – No Age Statement).

3. **ABV Extraction:**
   - Identify the ABV percentage and return it as a decimal (e.g., \`"abv": 46.3\` for \`"46.3% ABV"\`).

4. **Series and Edition Identification:**
   - If the whiskey is part of a named series (e.g., \`"Committee Release",\` \`"Limited Edition"\`), extract that into \`series\`.
   - If the label specifies an edition (e.g., \`"Batch 3",\` \`"2021 Release"\`), extract it into \`edition\`.

5. **Cask Type Extraction:**
   - If a maturation or finishing cask is mentioned (e.g., \`"Sherry Cask",\` \`"Bourbon Barrel"\`), include that in \`cask_type\`.

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
> **"Macallan Sherry Oak 18 Year 43.2% Single Malt Scotch Whisky"**

Output:
{
  "brand": "Macallan",
  "distillery": ["Macallan"],
  "expression": "Sherry Oak",
  "category": "single_malt",
  "series": null,
  "stated_age": 18,
  "abv": 43.2,
  "release_year": null,
  "vintage_year": null,
  "cask_type": "Oloroso Sherry",
  "edition": null,
}


#### **Blended Whiskey (Multiple Distilleries)**
Input:
> **"Compass Box Flaming Heart - Blend of Highland Park & Clynelish - 750ml"

Output:
{
  "brand": "Compass Box",
  "distillery": ["Highland Park", "Clynelish"],
  "expression": "Flaming Heart",
  "category": "blend",
  "series": null,
  "stated_age": null,
  "abv": null,
  "release_year": null,
  "vintage_year": null,
  "cask_type": null,
  "edition": null,
}

### **Independent Bottling**
Input:
> **"Gordon & MacPhail Caol Ila 12 Year - First Fill Bourbon Cask"**

Output:
{
  "brand": "Gordon & MacPhail",
  "distillery": ["Caol Ila"],
  "category": null,
  "expression": null,
  "series": null,
  "stated_age": 12,
  "abv": null,
  "release_year": null,
  "vintage_year": null,
  "cask_type": "First Fill Bourbon",
  "edition": null,
}

### **Unknown Blend (No Distilleries Listed)**
Input:
> **"Johnnie Walker Blue Label - 40% ABV - Blend of rare Scotch whiskies"**

Output:
{
  "brand": "Johnnie Walker",
  "distillery": [],
  "category": "blend",
  "expression": "Blue Label",
  "series": null,
  "stated_age": null,
  "abv": 40.0,
  "release_year": null,
  "vintage_year": null,
  "cask_type": null,
  "edition": null,
}
`;

const OpenAIBottleDetailsSchema = z.object({
  brand: z.string().nullish(),
  distillery: z.array(z.string()).nullish(),
  category: z.enum(CATEGORY_LIST).nullish(),
  expression: z.string().nullish(),
  series: z.string().nullish(),
  stated_age: z.number().nullish(),
  abv: z.number().nullish(),
  release_year: z.number().nullish(),
  vintage_year: z.number().nullish(),
  cask_type: z.string().nullish(),
  edition: z.string().nullish(),
});

export type ExtractedLabelDetails = z.infer<typeof OpenAIBottleDetailsSchema>;

export async function getExtractedLabelDetails(
  label: string,
): Promise<ExtractedLabelDetails | null> {
  return await startSpan(
    {
      op: "ai.pipeline",
      name: "generateBottleDetails",
    },
    async (span) => {
      return await getStructuredResponse(
        "generateBottleDetails",
        [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: label,
          },
        ],
        OpenAIBottleDetailsSchema,
      );
    },
  );
}

export default async function ({ label }: { label: string }) {
  if (!config.OPENAI_API_KEY) {
    return;
  }

  const result = await getExtractedLabelDetails(label);

  if (!result) {
    throw new Error(`Failed to extract details for label: ${label}`);
  }

  return result;
}
