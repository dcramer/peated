import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { regions } from "@peated/server/db/schema";
import { getStructuredResponse } from "@peated/server/lib/openai";
import { type Region } from "@peated/server/types";
import { startSpan } from "@sentry/node";
import { eq } from "drizzle-orm";
import { z } from "zod";

if (!config.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not configured.");
}

type InputRegion = Partial<Region> & Pick<Region, "country">;

function generatePrompt(region: InputRegion) {
  return [
    `Generate structured details for whisky production in ${region.name}, ${region.country.name}.`,
    [
      "'description' should be two short paragraphs separated by newlines.",
      "Cover the region's place in whisky history and the characteristics or reputation that distinguish it today.",
      "If the region is not widely associated with a formal whisky identity, keep the description high-level and factual.",
    ].join(" "),
  ].join("\n\n");
}

export const OpenAIRegionDetailsSchema = z.object({
  description: z.string().nullable().default(null),
});

export type GeneratedRegionDetails = z.infer<typeof OpenAIRegionDetailsSchema>;

export async function getGeneratedRegionDetails(
  region: InputRegion,
): Promise<GeneratedRegionDetails | null> {
  return await startSpan(
    {
      op: "ai.pipeline",
      name: "getGeneratedRegionDetails",
    },
    async (span) => {
      return await getStructuredResponse(
        "getGeneratedRegionDetails",
        generatePrompt(region),
        OpenAIRegionDetailsSchema,
        undefined,
        undefined,
        {
          region: {
            id: region.id,
            slug: region.slug,
            name: region.name,
          },
          country: {
            id: region.country.id,
            slug: region.country.slug,
            name: region.country.slug,
          },
        },
      );
    },
  );
}

export default async ({ regionId }: { regionId: number }) => {
  if (!config.OPENAI_API_KEY) {
    return;
  }

  const region = await db.query.regions.findFirst({
    where: (regions, { eq }) => eq(regions.id, regionId),
    with: {
      country: true,
    },
  });
  if (!region) {
    throw new Error(`Unknown region: ${regionId}`);
  }

  const generateDesc =
    !region.descriptionSrc || region.descriptionSrc === "generated";

  // test if we need to run at all
  if (!generateDesc) {
    return;
  }

  const result = await getGeneratedRegionDetails(region);

  if (!result) {
    throw new Error(`Failed to generate details for region: ${regionId}`);
  }
  const data: Record<string, any> = {};
  if (
    generateDesc &&
    result.description &&
    result.description !== region.description
  ) {
    data.description = result.description;
    data.descriptionSrc = "generated";
  }

  if (Object.keys(data).length === 0) return;

  await db.update(regions).set(data).where(eq(regions.id, region.id));
};
