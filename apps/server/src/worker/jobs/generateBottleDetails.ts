import config from "@peated/server/config";
import {
  CATEGORY_LIST,
  DEFAULT_CREATED_BY_ID,
  FLAVOR_PROFILES,
} from "@peated/server/constants";
import { db } from "@peated/server/db";
import type { Bottle } from "@peated/server/db/schema";
import { bottles, changes } from "@peated/server/db/schema";
import { arraysEqual, objectsShallowEqual } from "@peated/server/lib/equals";
import { notesForProfile } from "@peated/server/lib/format";
import { logError } from "@peated/server/lib/log";
import { getStructuredResponse } from "@peated/server/lib/openai";
import { CategoryEnum, FlavorProfileEnum } from "@peated/server/schemas";
import { startSpan } from "@sentry/node";
import { eq } from "drizzle-orm";
import { z } from "zod";

if (!config.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not configured.");
}

function generatePrompt(bottle: Partial<Bottle>, tagList: string[]) {
  const infoLines = [];
  if (bottle.category) {
    infoLines.push(`Category: ${bottle.category}`);
  }
  if (bottle.statedAge) {
    infoLines.push(`Stated Age: ${bottle.statedAge}`);
  }
  if (bottle.flavorProfile) {
    infoLines.push(`Flavor Profile: ${bottle.flavorProfile}`);
  }
  const sections = [
    `Generate structured details for this whisky bottle:\n\n${bottle.fullName}`,
    infoLines.length ? `Known context:\n- ${infoLines.join("\n- ")}` : null,
    [
      "'description' should be a concise overview for a novice whisky drinker.",
      "Use two or three short paragraphs separated by newlines.",
      "Use only broadly established facts, and do not repeat the bottle name more than once.",
    ].join(" "),
    [
      "'tastingNotes' should be concise and limited to smell and taste.",
      "Only include 'tastingNotes' when you can support all of 'nose', 'palate', and 'finish'; otherwise set it to null.",
    ].join(" "),
    [
      "'flavorProfile' must be one of the following values when it is strongly supported; otherwise return null:",
      `- ${FLAVOR_PROFILES.map((f) => `${f}: ${notesForProfile(f)}`).join("\n- ")}`,
    ].join("\n"),
    [
      "'category' must be one of the following values when it is strongly supported; otherwise return null:",
      `- ${CATEGORY_LIST.join("\n- ")}`,
    ].join("\n"),
    tagList.length
      ? [
          "'suggestedTags' may contain up to five items when they are strongly supported by the bottle's style or profile.",
          "If no tags are well supported, return an empty array.",
          "Values must come from this list:",
          `- ${tagList.join("\n- ")}`,
        ].join("\n")
      : "'suggestedTags' should be an empty array when no allowed tag list is provided.",
  ];

  return sections.filter(Boolean).join("\n\n");
}

export const OpenAIBottleDetailsSchema = z.object({
  description: z.string().nullable().default(null),
  tastingNotes: z
    .object({
      nose: z.string(),
      palate: z.string(),
      finish: z.string(),
    })
    .nullable()
    .default(null),
  category: z.string().nullable().default(null),
  suggestedTags: z.array(z.string()).default([]),
  flavorProfile: z.string().nullable().default(null),
});

// we dont send enums to openai as they dont get used
export const OpenAIBottleDetailsValidationSchema =
  OpenAIBottleDetailsSchema.extend({
    category: CategoryEnum.nullable().default(null),
    flavorProfile: FlavorProfileEnum.nullable().default(null),
    // TODO: ChatGPT is ignoring this shit, so lets validate later and throw away if invalid
    // suggestedTags: z.array(DefaultTagEnum).default([]),
  });

export type GeneratedBottleDetails = z.infer<typeof OpenAIBottleDetailsSchema>;

export async function getGeneratedBottleDetails(
  bottle: Partial<Bottle>,
  tagList: string[],
): Promise<GeneratedBottleDetails | null> {
  return await startSpan(
    {
      op: "ai.pipeline",
      name: "generateBottleDetails",
    },
    async (span) => {
      return await getStructuredResponse(
        "generateBottleDetails",
        generatePrompt(bottle, tagList),
        OpenAIBottleDetailsSchema,
        OpenAIBottleDetailsValidationSchema,
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
