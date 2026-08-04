import { type AuditBottleInput } from "@peated/bottle-classifier";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { bottleChecks } from "@peated/server/db/schema";
import {
  createBottleCheck,
  deleteTerminalModeratorBottleAudits,
  getCurrentModeratorBottleAudit,
  type BottleCheckWithOperations,
  type CreateBottleCheckResult,
} from "@peated/server/lib/bottleChecks";
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

export type ModeratorBottleAuditResult =
  | { status: "clean"; summary: string }
  | { status: "needs_review"; check: BottleCheckWithOperations };

async function runAndPersistBottleAudit({
  input,
  backgroundEventKey,
}: {
  input: AuditBottleInput;
  backgroundEventKey?: string;
}): Promise<CreateBottleCheckResult> {
  const { result, modelMetadata } = await auditBottleWithServerAdapters(input);

  return await createBottleCheck({
    intent: "audit_bottle",
    input,
    result,
    model: config.BOTTLE_CLASSIFIER_MODEL,
    modelMetadata,
    ...(backgroundEventKey ? { backgroundEventKey } : {}),
  });
}

export async function runModeratorBottleAudit(
  rawInput: ModeratorBottleAuditInput,
): Promise<ModeratorBottleAuditResult> {
  const input = ModeratorBottleAuditInputSchema.parse(rawInput);
  const existing = await getCurrentModeratorBottleAudit(input.bottleId);
  if (existing) {
    return { status: "needs_review", check: existing };
  }

  const auditInput: AuditBottleInput = {
    bottleId: input.bottleId,
    origin: "moderator",
    ...(input.note ? { note: input.note } : {}),
  };
  const { result, modelMetadata } =
    await auditBottleWithServerAdapters(auditInput);
  if (result.proposedOperations.length === 0 && result.findings.length === 0) {
    await deleteTerminalModeratorBottleAudits({
      bottleId: input.bottleId,
    });
    return {
      status: "clean",
      summary: result.summary,
    };
  }

  const created = await createBottleCheck({
    intent: "audit_bottle",
    input: auditInput,
    result,
    model: config.BOTTLE_CLASSIFIER_MODEL,
    modelMetadata,
  });
  await deleteTerminalModeratorBottleAudits({
    bottleId: input.bottleId,
    exceptCheckId: created.check.id,
  });
  return {
    status: "needs_review",
    check: created.check,
  };
}

export async function runPostUserCreationBottleAudit(
  rawInput: PostUserCreationBottleAuditInput,
): Promise<CreateBottleCheckResult> {
  const input = PostUserCreationBottleAuditInputSchema.parse(rawInput);
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
