import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { countries } from "@peated/server/db/schema";
import { getStructuredResponse } from "@peated/server/lib/openai";
import { type Country } from "@peated/server/types";
import { startSpan } from "@sentry/node";
import { eq } from "drizzle-orm";
import { z } from "zod";

if (!config.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not configured.");
}

type InputCountry = Partial<Country>;

function generatePrompt(country: InputCountry) {
  return `
Tell me about the whisky culture in ${country.name}, and what sets it apart from other regions.

'summary' should be one or two sentences that describe the requirements, if any for whisky produced in the region.

'description' should include two or three sections, formatted as paragraphs using newlines:

The first paragraph should focus on the region's history & origin.
The second paragraph should describe the region's unique approach, what styles it produces, and any interesting related facts.
The third paragraph, should describe any requirements to producing whisky in the region.
`;
}

export const OpenAICountryDetailsSchema = z.object({
  description: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
});

export type GeneratedCountryDetails = z.infer<
  typeof OpenAICountryDetailsSchema
>;

export async function getGeneratedCountryDetails(
  country: InputCountry,
): Promise<GeneratedCountryDetails | null> {
  return await startSpan(
    {
      op: "ai.pipeline",
      name: "getGeneratedCountryDetails",
    },
    async (span) => {
      return await getStructuredResponse(
        "getGeneratedCountryDetails",
        generatePrompt(country),
        OpenAICountryDetailsSchema,
        undefined,
        undefined,
        {
          country: {
            id: country.slug,
            name: country.name,
          },
        },
      );
    },
  );
}

export default async ({ countryId }: { countryId: number }) => {
  if (!config.OPENAI_API_KEY) {
    return;
  }

  const country = await db.query.countries.findFirst({
    where: (counries, { eq }) => eq(counries.id, countryId),
    with: {
      country: true,
    },
  });
  if (!country) {
    throw new Error(`Unknown country: ${countryId}`);
  }

  const generateDesc =
    !country.descriptionSrc || country.descriptionSrc === "generated";

  // test if we need to run at all
  if (!generateDesc) {
    return;
  }

  const result = await getGeneratedCountryDetails(country);

  if (!result) {
    throw new Error(`Failed to generate details for country: ${countryId}`);
  }
  const data: Record<string, any> = {};
  if (
    generateDesc &&
    result.description &&
    result.description !== country.description
  ) {
    data.description = result.description;
    data.descriptionSrc = "generated";
  }

  if (!country.summary && result.summary) {
    data.summary = result.summary;
  }

  if (Object.keys(data).length === 0) return;

  await db.update(countries).set(data).where(eq(countries.id, country.id));
};
