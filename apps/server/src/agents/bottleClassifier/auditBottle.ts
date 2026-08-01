import {
  getBottleCheckSourceEvidencePaths,
  type AuditBottleInput,
} from "@peated/bottle-classifier";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { bottleChecks } from "@peated/server/db/schema";
import {
  createBottleCheck,
  type CreateBottleCheckResult,
} from "@peated/server/lib/bottleChecks";
import { prepareProposals } from "@peated/server/lib/bottleOperationReview";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { runBottleAudit as auditBottleWithServerAdapters } from "./service";

const PositiveIdSchema = z.number().int().positive();
const NonEmptyTextSchema = z.string().trim().min(1);

export const ModeratorBottleAuditInputSchema = z
  .object({
    bottleId: PositiveIdSchema,
    note: NonEmptyTextSchema.optional(),
  })
  .strict();

const PostUserCreationBottleAuditInputSchema =
  ModeratorBottleAuditInputSchema.extend({
    backgroundEventKey: NonEmptyTextSchema.max(255),
  }).strict();

export type ModeratorBottleAuditInput = z.input<
  typeof ModeratorBottleAuditInputSchema
>;
export type PostUserCreationBottleAuditInput = z.input<
  typeof PostUserCreationBottleAuditInputSchema
>;

export class BottleAuditUnavailableError extends Error {
  constructor() {
    super("Bottle audit generation is not enabled.");
    this.name = "BottleAuditUnavailableError";
  }
}

async function runAndPersistBottleAudit({
  input,
  backgroundEventKey,
}: {
  input: AuditBottleInput;
  backgroundEventKey?: string;
}): Promise<CreateBottleCheckResult> {
  const { result, modelMetadata } = await auditBottleWithServerAdapters(input);
  const operations = await prepareProposals({
    proposals: result.proposedOperations,
    artifacts: result.artifacts,
    sourceFields: getBottleCheckSourceEvidencePaths({
      intent: "audit_bottle",
      input,
      artifacts: result.artifacts,
    }),
    protectedBottleIds: [],
  });

  return await createBottleCheck({
    intent: "audit_bottle",
    input,
    result,
    operations,
    model: config.OPENAI_MODEL,
    modelMetadata,
    ...(backgroundEventKey ? { backgroundEventKey } : {}),
  });
}

export async function runModeratorBottleAudit(
  rawInput: ModeratorBottleAuditInput,
): Promise<CreateBottleCheckResult> {
  const input = ModeratorBottleAuditInputSchema.parse(rawInput);
  if (!config.BOTTLE_CHECK_SHADOW_GENERATION) {
    throw new BottleAuditUnavailableError();
  }

  return await runAndPersistBottleAudit({
    input: {
      bottleId: input.bottleId,
      origin: "moderator",
      ...(input.note ? { note: input.note } : {}),
    },
  });
}

export async function runPostUserCreationBottleAudit(
  rawInput: PostUserCreationBottleAuditInput,
): Promise<CreateBottleCheckResult | null> {
  const input = PostUserCreationBottleAuditInputSchema.parse(rawInput);
  if (!config.BOTTLE_CHECK_SHADOW_GENERATION) {
    return null;
  }

  const existing = await db.query.bottleChecks.findFirst({
    where: eq(bottleChecks.backgroundEventKey, input.backgroundEventKey),
    with: { operations: true },
  });
  if (existing) {
    if (
      existing.intent !== "audit_bottle" ||
      existing.origin !== "post_user_creation" ||
      existing.bottleId !== input.bottleId
    ) {
      throw new Error(
        "Bottle audit background event key belongs to a different subject.",
      );
    }
    return { check: existing, created: false };
  }

  return await runAndPersistBottleAudit({
    input: {
      bottleId: input.bottleId,
      origin: "post_user_creation",
      ...(input.note ? { note: input.note } : {}),
    },
    backgroundEventKey: input.backgroundEventKey,
  });
}
