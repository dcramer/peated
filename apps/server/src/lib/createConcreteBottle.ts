/**
 * Owns parsed input, transaction, and post-commit dispatch for concrete Bottle
 * creation. Independent creates are singletons; reuse requires a trusted source
 * Bottle.
 */
import type { CatalogVerificationCreationSource } from "@peated/catalog-verifier";
import { db } from "@peated/server/db";
import type { User } from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import {
  type ConcreteBottleCreateResult,
  createConcreteBottleInTransaction,
  finalizeCreatedBottle,
} from "@peated/server/lib/createBottle";
import type { Context } from "@peated/server/orpc/context";
import { BottleInputSchema } from "@peated/server/schemas";
import { z } from "zod";

const StableBottleGroupInputSchema = BottleInputSchema.pick({
  name: true,
  statedAge: true,
  series: true,
  category: true,
  brand: true,
  distillers: true,
  bottler: true,
  flavorProfile: true,
})
  .extend({
    statedAge: z.number().int().min(0).max(100).nullable().default(null),
  })
  .strict()
  .superRefine((input, ctx) => {
    const validateChoiceId = (
      choice: number | { id?: number | null } | null | undefined,
      path: (string | number)[],
    ) => {
      const id = typeof choice === "number" ? choice : choice?.id;
      if (
        id !== null &&
        id !== undefined &&
        (!Number.isInteger(id) || id <= 0)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ID must be a positive integer.",
          path: [...path, ...(typeof choice === "number" ? [] : ["id"])],
        });
      }
    };

    validateChoiceId(input.brand, ["brand"]);
    validateChoiceId(input.bottler, ["bottler"]);
    validateChoiceId(input.series, ["series"]);
    input.distillers?.forEach((distiller, index) =>
      validateChoiceId(distiller, ["distillers", index]),
    );
  });

const ExactBottleInputSchema = BottleInputSchema.pick({
  edition: true,
  statedAge: true,
  abv: true,
  singleCask: true,
  caskStrength: true,
  vintageYear: true,
  releaseYear: true,
  caskSize: true,
  caskType: true,
  caskFill: true,
  description: true,
  descriptionSrc: true,
})
  .extend({
    statedAge: z.number().int().min(0).max(100).nullable().default(null),
    vintageYear: z
      .number()
      .int()
      .gte(1800)
      .lte(new Date().getFullYear())
      .nullable()
      .default(null),
    releaseYear: z
      .number()
      .int()
      .gte(1800)
      .lte(new Date().getFullYear())
      .nullable()
      .default(null),
  })
  .strict();

/** Runtime contract consumed by future public route adapters. */
export const ConcreteBottleCreateInputSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("independent"),
      stable: StableBottleGroupInputSchema,
      exact: ExactBottleInputSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("source_bottle"),
      sourceBottleId: z.number().int().positive(),
      exact: ExactBottleInputSchema,
    })
    .strict(),
]);

export type ConcreteBottleCreateInput = z.infer<
  typeof ConcreteBottleCreateInputSchema
>;

export {
  createConcreteBottleInTransaction,
  TrustedSourceBottleError,
} from "@peated/server/lib/createBottle";
export type {
  ConcreteBottleCreateResult,
  LikelyBottleGroupSuggestion,
  TrustedSourceBottleErrorCode,
} from "@peated/server/lib/createBottle";

export type CreateConcreteBottleResult = Pick<
  ConcreteBottleCreateResult,
  "bottle" | "group" | "genericTarget" | "exactTarget" | "likelyGroups"
>;

/** Parses untrusted input once and owns transaction plus post-commit dispatch. */
export async function createConcreteBottle({
  creationSource = "manual_entry",
  input: rawInput,
  context,
}: {
  creationSource?: CatalogVerificationCreationSource;
  input: unknown;
  context: Context & { user: User };
}): Promise<CreateConcreteBottleResult> {
  const input = ConcreteBottleCreateInputSchema.parse(rawInput);
  const actor = await getUserActor(context.user);
  const result = await db.transaction(async (tx) =>
    createConcreteBottleInTransaction(tx, {
      creationSource,
      createdByActorId: actor.id,
      input,
      context,
    }),
  );

  await finalizeCreatedBottle(result, { creationSource });
  return {
    bottle: result.bottle,
    group: result.group,
    genericTarget: result.genericTarget,
    exactTarget: result.exactTarget,
    likelyGroups: result.likelyGroups,
  };
}
