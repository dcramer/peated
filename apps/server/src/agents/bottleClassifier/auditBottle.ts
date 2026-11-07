import {
  BLOCKED_BOTTLE_FIELDS,
  type AuditBottleInput,
  type BlockedBottle,
} from "@peated/bottle-classifier";
import type {
  BottleContextExact,
  BottleContextShared,
} from "@peated/bottle-classifier/contract";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { bottleChecks } from "@peated/server/db/schema";
import {
  createBottleCheck,
  deleteTerminalModeratorBottleAudits,
  getCurrentBottleAudit,
  getCurrentModeratorBottleAudit,
  type BottleCheckWithOperations,
  type CreateBottleCheckResult,
} from "@peated/server/lib/bottleChecks";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getBottleClassifierContext } from "./contextAdapters";
import { runBottleAudit as auditBottleWithServerAdapters } from "./service";

const PositiveIdSchema = z.number().int().positive();
const NonEmptyTextSchema = z.string().trim().min(1);

export const ModeratorBottleAuditInputFields = {
  bottleId: PositiveIdSchema,
  note: NonEmptyTextSchema.optional(),
} as const;

export const ModeratorBottleAuditInputSchema = z
  .object(ModeratorBottleAuditInputFields)
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

export async function runModeratorBottleAudit(
  rawInput: ModeratorBottleAuditInput,
  runAudit: typeof auditBottleWithServerAdapters = auditBottleWithServerAdapters,
): Promise<ModeratorBottleAuditResult> {
  const input = ModeratorBottleAuditInputSchema.parse(rawInput);
  const existing = await getCurrentModeratorBottleAudit(input.bottleId);
  if (existing) {
    return { status: "needs_review", check: existing };
  }

  const auditInput: AuditBottleInput = {
    bottleId: input.bottleId,
    origin: "moderator",
  };
  if (input.note) auditInput.note = input.note;
  const { result, modelMetadata } = await runAudit(auditInput);
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
  runAudit: typeof auditBottleWithServerAdapters = auditBottleWithServerAdapters,
): Promise<CreateBottleCheckResult | null> {
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

  const bottle = await db.query.bottles.findFirst({
    columns: { id: true },
    where: (bottles, { eq }) => eq(bottles.id, input.bottleId),
  });
  if (!bottle) return null;

  const auditInput: AuditBottleInput = {
    bottleId: input.bottleId,
    origin: "post_user_creation",
  };
  if (input.note) auditInput.note = input.note;
  const { result, modelMetadata } = await runAudit(auditInput);
  const activeBottle = await db.query.bottles.findFirst({
    columns: { id: true },
    where: (bottles, { eq }) => eq(bottles.id, input.bottleId),
  });
  if (!activeBottle) return null;

  return await createBottleCheck({
    intent: "audit_bottle",
    input: auditInput,
    result,
    model: config.BOTTLE_CLASSIFIER_MODEL,
    modelMetadata,
    backgroundEventKey: input.backgroundEventKey,
  });
}

export const BlockedBottleAuditInputSchema = z
  .object({
    bottleId: PositiveIdSchema,
    fields: z.array(z.enum(BLOCKED_BOTTLE_FIELDS)).min(1),
    note: NonEmptyTextSchema.max(1000),
  })
  .strict();

type BlockedBottleField = (typeof BLOCKED_BOTTLE_FIELDS)[number];
type StoredFieldValue =
  | BottleContextShared[keyof BottleContextShared]
  | BottleContextExact[keyof BottleContextExact];

export type BlockedBottleAuditInput = Pick<
  BlockedBottle,
  "bottleId" | "fields" | "note"
>;

/**
 * Blocked Bottle review (owner: Bottle classifier). A reference run named this
 * Bottle as the source's Bottle but found stored fields that evidence
 * contradicts. One Bottle Review checks those fields. The event key holds the
 * fields' current stored values, so a moderator who rejects the change is not
 * asked again until those values change, and many sources that name the same
 * conflict share one review.
 */
export async function runBlockedBottleAudit(
  rawInput: BlockedBottleAuditInput,
  runAudit: typeof auditBottleWithServerAdapters = auditBottleWithServerAdapters,
): Promise<CreateBottleCheckResult | null> {
  const input = BlockedBottleAuditInputSchema.parse(rawInput);
  const context = await getBottleClassifierContext(input.bottleId);
  if (!context) return null;

  const { shared, exact } = context;
  const storedFields = {
    name: shared.name,
    brand: shared.brand,
    bottler: shared.bottler,
    distillers: shared.distillers,
    series: shared.series,
    category: shared.category,
    statedAge: exact.statedAge ?? shared.statedAge,
    abv: exact.abv,
    edition: exact.edition,
    vintageYear: exact.vintageYear,
    bottlingYear: exact.bottlingYear,
    releaseYear: exact.releaseYear,
    caskNumber: exact.caskNumber,
    caskStrength: exact.caskStrength,
    singleCask: exact.singleCask,
  } satisfies Record<BlockedBottleField, StoredFieldValue>;
  const fields = [...new Set(input.fields)].sort();
  const storedValues = fields.map((field) => [field, storedFields[field]]);
  const backgroundEventKey = `blocked_bottle:${input.bottleId}:${createHash(
    "sha256",
  )
    .update(JSON.stringify(storedValues))
    .digest("hex")}`;

  const existing = await db.query.bottleChecks.findFirst({
    where: eq(bottleChecks.backgroundEventKey, backgroundEventKey),
    with: { operations: true },
  });
  if (existing) return { check: existing, created: false };
  // Another open review of this Bottle already covers the work.
  if (await getCurrentBottleAudit(input.bottleId)) return null;

  const auditInput: AuditBottleInput = {
    bottleId: input.bottleId,
    origin: "reference_conflict",
    note: [
      `A reference classifier run identified a source as this Bottle, but source evidence contradicts these stored fields: ${fields.join(", ")}.`,
      `Classifier note: ${input.note}`,
      "Check each field with evidence for this exact Bottle.",
    ].join(" "),
  };
  const { result, modelMetadata } = await runAudit(auditInput);
  const activeBottle = await db.query.bottles.findFirst({
    columns: { id: true },
    where: (bottles, { eq }) => eq(bottles.id, input.bottleId),
  });
  if (!activeBottle) return null;

  return await createBottleCheck({
    intent: "audit_bottle",
    input: auditInput,
    result,
    model: config.BOTTLE_CLASSIFIER_MODEL,
    modelMetadata,
    backgroundEventKey,
  });
}
