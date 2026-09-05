import { db } from "@peated/server/db";
import { bottles, bottleTombstones } from "@peated/server/db/schema";
import {
  buildBottleCreateCandidateQueries,
  rankBottleCreateCandidates,
} from "@peated/server/lib/bottleCreateCandidates";
import { plainTextSearchQuery } from "@peated/server/lib/search";
import { procedure } from "@peated/server/orpc";
import {
  BottleInputFields,
  BottleSchema,
  listResponse,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { and, desc, isNotNull, or, sql } from "drizzle-orm";
import { z } from "zod";

const IdentityChoiceSchema = z.object({
  id: z.number().int().positive().nullish(),
  name: z.string().trim().min(1).max(255),
});

const InputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  brand: IdentityChoiceSchema.nullish(),
  distillers: z.array(IdentityChoiceSchema).max(20).default([]),
  bottler: IdentityChoiceSchema.nullish(),
  series: IdentityChoiceSchema.nullish(),
  category: BottleInputFields.category,
  edition: BottleInputFields.edition,
  statedAge: BottleInputFields.statedAge,
  noAgeStatement: BottleInputFields.noAgeStatement,
  caskStrength: BottleInputFields.caskStrength,
  singleCask: BottleInputFields.singleCask,
  naturalColor: BottleInputFields.naturalColor,
  nonChillFiltered: BottleInputFields.nonChillFiltered,
  maltPhenolPpm: BottleInputFields.maltPhenolPpm,
  abv: BottleInputFields.abv,
  vintageYear: BottleInputFields.vintageYear,
  bottlingYear: BottleInputFields.bottlingYear,
  releaseYear: BottleInputFields.releaseYear,
  releaseMonth: BottleInputFields.releaseMonth,
  releaseDay: BottleInputFields.releaseDay,
  maturation: BottleInputFields.maturation,
  caskNumber: BottleInputFields.caskNumber,
  outturn: BottleInputFields.outturn,
  description: BottleInputFields.description,
  descriptionSrc: BottleInputFields.descriptionSrc,
  flavorProfile: BottleInputFields.flavorProfile,
  tastingNotes: BottleInputFields.tastingNotes,
  limit: z.coerce.number().int().gte(1).lte(10).default(3),
});

export default procedure
  .route({
    method: "GET",
    path: "/bottles/create-candidates",
    summary: "Find possible existing Bottles before creation",
    description:
      "Return advisory Bottle candidates from entered identity and release facts without changing or blocking the submitted Bottle.",
    spec: (spec) => ({
      ...spec,
      operationId: "getBottleCreateCandidates",
    }),
  })
  .input(InputSchema)
  .output(listResponse(BottleSchema))
  .handler(async ({ input, context }) => {
    const { limit, ...candidateInput } = input;
    const searchQueries = buildBottleCreateCandidateQueries(candidateInput);
    if (!searchQueries.length) {
      return {
        results: [],
        rel: { nextCursor: null, prevCursor: null },
      };
    }

    const searchConditions = searchQueries.map(
      (query) => sql`${bottles.searchVector} @@ ${plainTextSearchQuery(query)}`,
    );
    const candidateRows = await db
      .select()
      .from(bottles)
      .where(
        and(
          isNotNull(bottles.groupId),
          sql`NOT EXISTS(SELECT FROM ${bottleTombstones} WHERE ${bottleTombstones.bottleId} = ${bottles.id})`,
          or(...searchConditions),
        ),
      )
      .orderBy(desc(bottles.totalTastings), desc(bottles.updatedAt))
      .limit(100);
    const serialized = await serialize(
      BottleSerializer,
      candidateRows,
      context.user,
      ["description", "tastingNotes"],
      { includeGroupSummary: true },
    );

    return {
      results: rankBottleCreateCandidates(candidateInput, serialized, limit),
      rel: { nextCursor: null, prevCursor: null },
    };
  });
