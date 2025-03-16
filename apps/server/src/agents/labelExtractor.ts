import OpenAI from "openai";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { CATEGORY_LIST } from "../constants";

const EXTRACTION_LABEL_PROMPT = `The fields to extract are:

- **brand**: The brand or bottler of the whiskey.
- **distillery**: An **array** of distilleries where the whiskey was produced (e.g., \`[ "Macallan", "Highland Park" ]\` for a blend of multiple distilleries, or \`[ "Lagavulin" ]\` for a single distillery release). If the whiskey is an **official bottling** from a single distillery, return \`[ distillery_name ]\`. If it’s a blend with unknown distilleries, return \`[]\` (empty array). If it is an independent bottling, return the distillery name(s) in the array.
- **expression**: The specific name or expression of the whiskey.
- **series**: The series or collection name (if applicable, otherwise \`null\`).
- **category**: The category of the whiskey. One of \`blend\`, \`bourbon\`, \`rye\`, \`single_grain\`, \`single_malt\`, \`single_pot_still\`.
- **stated_age**: Age of the whiskey in years (integer, \`null\` if no age statement).
- **abv**: Alcohol by volume as a percentage (float, e.g., 43.0 for 43% ABV).
- **release_year**: The year the whiskey was bottled or released.
  - Extract if explicitly labeled as "Bottling Year," "Bottled in YYYY," "Release Year," or similar.
  - If no explicit label, extract any standalone four-digit year (YYYY) if it appears near ABV, batch, or edition information.
  - Ignore unrelated dates (e.g., distillery establishment year, government warnings).
  - If multiple years are listed (e.g., "Distilled in 1998, Bottled in 2018"), use:
    - vintage_year: 1998
    - release_year: 2018
  - If no valid year is found, set \`release_year\`: null.
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
   - When including the age statement as part of the expression, it should always be in this format: \`"12-year-old"\`

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

If you cannot extract the required attributes, return \`null\` for the entire object.

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


#### **Single Expression**
Input:
> **"Octomore 13.1"**

Output:
{
  "brand": "Octomore",
  "distillery": ["Octomore"],
  "expression": "13.1",
  "category": "single_malt",
  "series": "13",
  "stated_age": null,
  "abv": null,
  "release_year": null,
  "vintage_year": null,
  "cask_type": null,
  "edition": null,
}

Note: In the above example, we know the series is "Octomore 13" because this is how Octomore labels its bottles.

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

### **Unknown Brand**
Input:
> **"Single Malt 12-year-old"**

Output:
null`;

const imageInstructions = `You are an advanced data extraction assistant with expertise in whiskey labeling conventions. Your task is to analyze the provided **image** of a whiskey bottle label and extract structured data in **JSON format**.

### **Instructions:**

1. Carefully examine the image to identify key whiskey details such as brand, distillery, age statement, ABV, and edition.
2. Normalize the extracted information based on standard whiskey labeling conventions.
3. Return only a **valid JSON object** with extracted values, using null for missing information.

${EXTRACTION_LABEL_PROMPT}
`;

const textInstructions = `You are a data extraction assistant with expertise in whiskey labeling conventions. Extract the whiskey details from the given label description and output them in **JSON** format with the specified fields.

### **Instructions:**

1. Carefully analyze the text to identify key whiskey details such as brand, distillery, age statement, ABV, and edition.
2. Normalize the extracted information based on standard whiskey labeling conventions.
3. Return only a **valid JSON object** with extracted values, using null for missing information.

${EXTRACTION_LABEL_PROMPT}`;

const ExtractedBottleDetailsSchema = z.object({
  brand: z.string(),
  expression: z.string(),
  series: z.string().nullable(),
  distillery: z.array(z.string()).nullable(),
  category: z.enum(CATEGORY_LIST).nullable(),
  stated_age: z.number().nullable(),
  abv: z.number().nullable(),
  release_year: z.number().nullable(),
  vintage_year: z.number().nullable(),
  cask_type: z.string().nullable(),
  edition: z.string().nullable(),
});

const Response = z.object({
  result: ExtractedBottleDetailsSchema.nullable(),
});

export const extractFromImage = async (imageUrlOrBase64: string) => {
  const client = new OpenAI();

  const response = await client.responses.create({
    model: "gpt-4o-2024-08-06",
    input: [
      { role: "system", content: imageInstructions },
      {
        role: "user",
        content: [
          {
            type: "input_image",
            image_url: imageUrlOrBase64,
            detail: "auto",
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ExtractedBottleDetails",
        schema: zodToJsonSchema(Response),
      },
    },
  });

  console.log(response);

  const { result } = JSON.parse(response.output_text);
  return result;
};

export const extractFromText = async (label: string) => {
  const client = new OpenAI();

  const response = await client.responses.create({
    model: "gpt-4o-2024-08-06",
    input: [
      { role: "system", content: textInstructions },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: label,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ExtractedBottleDetails",
        schema: zodToJsonSchema(Response),
      },
    },
  });

  const { result } = JSON.parse(response.output_text);
  return result;
};
