import config from "@peated/server/config";
import { CATEGORY_LIST, FLAVOR_PROFILES } from "@peated/server/constants";
import { db } from "@peated/server/db";
import type { Bottle } from "@peated/server/db/schema";
import {
  bottleGroupDistillers,
  bottleGroups,
  bottles,
  bottleSeries,
  bottleTombstones,
} from "@peated/server/db/schema";
import { getPeatedSystemActorForDatabase } from "@peated/server/lib/actors";
import {
  SystemBottlePatchSchema,
  type SystemBottlePatch,
} from "@peated/server/lib/bottleSchemas";
import { arraysEqual, objectsShallowEqual } from "@peated/server/lib/equals";
import { notesForProfile } from "@peated/server/lib/format";
import { logWarn } from "@peated/server/lib/log";
import { getStructuredResponse } from "@peated/server/lib/openai";
import { withSentryConversation } from "@peated/server/lib/openaiClient";
import {
  BottleUpdateExpectedBottleStateError,
  bottleUpdateExpectedSelectedBottleState,
  bottleUpdateExpectedSharedState,
  BottleUpdateExpectedStateError,
  finalizeBottleUpdate,
  updateBottleInTransaction,
} from "@peated/server/lib/updateBottle";
import { CategoryEnum, FlavorProfileEnum } from "@peated/server/schemas";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

if (!config.AI_GATEWAY_API_KEY) {
  logWarn("AI_GATEWAY_API_KEY is not configured", {});
}

export const GenerateBottleDetailsJobArgsSchema = z
  .object({
    bottleId: z.number().int().positive(),
  })
  .strict();

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

export type GeneratedBottleDetails = z.infer<
  typeof OpenAIBottleDetailsValidationSchema
>;

export async function getGeneratedBottleDetails(
  bottle: Partial<Bottle>,
  tagList: string[],
): Promise<GeneratedBottleDetails | null> {
  const conversationId = bottle.id
    ? `bottle_details:${bottle.id}`
    : `ai:bottle_lookup:${bottle.fullName ?? bottle.name ?? "draft"}`;

  const result = await withSentryConversation(
    conversationId,
    async () =>
      await getStructuredResponse(
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
      ),
  );

  if (!result) return null;

  const allowedTags = new Set(tagList);
  return {
    ...result,
    suggestedTags: result.suggestedTags.filter((tag) => allowedTags.has(tag)),
  };
}

export default async function generateBottleDetails(rawJobArgs: unknown) {
  const { bottleId } = GenerateBottleDetailsJobArgsSchema.parse(rawJobArgs);

  const [owned] = await db
    .select({
      bottle: bottles,
      group: bottleGroups,
      series: bottleSeries,
    })
    .from(bottles)
    .innerJoin(bottleGroups, eq(bottleGroups.id, bottles.groupId))
    .leftJoin(bottleSeries, eq(bottleSeries.id, bottleGroups.seriesId))
    .leftJoin(bottleTombstones, eq(bottleTombstones.bottleId, bottles.id))
    .where(and(eq(bottles.id, bottleId), isNull(bottleTombstones.bottleId)))
    .limit(1);
  if (!owned) {
    throw new Error(
      `Bottle ${bottleId} does not belong to an active BottleGroup.`,
    );
  }
  const bottle = owned.bottle;
  if (
    owned.group.representativeBottleId === null ||
    (owned.group.seriesId !== null && !owned.series)
  ) {
    throw new Error(`Bottle ${bottleId} has invalid shared authority.`);
  }
  const groupDistillers = await db
    .select({ distillerId: bottleGroupDistillers.distillerId })
    .from(bottleGroupDistillers)
    .where(eq(bottleGroupDistillers.groupId, owned.group.id));
  const expectedSelectedBottleState =
    bottleUpdateExpectedSelectedBottleState(bottle);
  const expectedSharedState = bottleUpdateExpectedSharedState({
    group: owned.group,
    distillerIds: groupDistillers.map(({ distillerId }) => distillerId),
    series: owned.series,
  });

  if (!config.AI_GATEWAY_API_KEY) {
    return;
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

  const patch: SystemBottlePatch = {};

  if (
    generateDesc &&
    result.description &&
    result.description !== bottle.description
  ) {
    patch.description = result.description;
    patch.descriptionSrc = "generated";
  }

  if (
    result.tastingNotes &&
    (!bottle.tastingNotes ||
      !objectsShallowEqual(result.tastingNotes, bottle.tastingNotes))
  ) {
    patch.tastingNotes = result.tastingNotes;
  }

  if (
    result.suggestedTags?.length &&
    !arraysEqual(result.suggestedTags, bottle.suggestedTags)
  ) {
    patch.suggestedTags = result.suggestedTags;
  }

  if (!bottle.flavorProfile) {
    const flavorProfile = owned.group.flavorProfile ?? result.flavorProfile;
    if (flavorProfile) {
      patch.flavorProfile = flavorProfile;
    }
  }

  if (Object.keys(patch).length === 0) return;
  const input = SystemBottlePatchSchema.parse(patch);
  let update;
  try {
    update = await db.transaction(async (tx) => {
      const actor = await getPeatedSystemActorForDatabase(tx);
      return await updateBottleInTransaction(tx, {
        bottleId: bottle.id,
        input,
        expectedSelectedBottleState,
        expectedSharedState,
        actorId: actor.id,
        creationSource: "repair_workflow",
      });
    });
  } catch (error) {
    // Generated details belong only to the snapshot sent to the model. A newer
    // authoritative edit supersedes them, so the stale result is discarded.
    if (
      error instanceof BottleUpdateExpectedBottleStateError ||
      error instanceof BottleUpdateExpectedStateError
    ) {
      return;
    }
    throw error;
  }
  await finalizeBottleUpdate(update);
}
