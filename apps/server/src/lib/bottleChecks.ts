import {
  AuditBottleInputSchema,
  AuditBottleOriginSchema,
  AuditBottleResultSchema,
  BottleClassificationResultSchema,
  ClassifyBottleReferenceInputSchema,
  EvidenceRefSchema,
  FindingSchema,
  ProposedOperationSchema,
} from "@peated/bottle-classifier";
import { db, type AnyConnection, type AnyDatabase } from "@peated/server/db";
import {
  bottleChecks,
  bottleOperations,
  storePriceMatchAttempts,
  type BottleCheck,
  type BottleOperation,
  type User,
} from "@peated/server/db/schema";
import { assertCollectedEvidenceRefs } from "@peated/server/lib/bottleOperationReview";
import { and, desc, eq, exists, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

export const BOTTLE_CHECK_SCHEMA_VERSION = 1;

const NonEmptyTextSchema = z.string().trim().min(1);
const PositiveIdSchema = z.number().int().positive();

type JsonValue =
  | boolean
  | JsonValue[]
  | null
  | number
  | string
  | { [key: string]: JsonValue };

const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

const JsonObjectSchema = z.record(z.string(), JsonValueSchema);

const MAX_STATE_TOKEN_DEPTH = 5;
const MAX_STATE_TOKEN_KEYS = 64;
const MAX_STATE_TOKEN_ARRAY_LENGTH = 100;
const MAX_STATE_TOKEN_STRING_LENGTH = 4096;

const StateTokenPrimitiveSchema = z.union([
  z.string().max(MAX_STATE_TOKEN_STRING_LENGTH),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

function boundedStateTokenValueSchema(depth: number): z.ZodType<JsonValue> {
  if (depth === 0) {
    return StateTokenPrimitiveSchema;
  }

  const nestedValueSchema = boundedStateTokenValueSchema(depth - 1);
  return z.union([
    StateTokenPrimitiveSchema,
    z.array(nestedValueSchema).max(MAX_STATE_TOKEN_ARRAY_LENGTH),
    z
      .record(z.string().max(255), nestedValueSchema)
      .refine((value) => Object.keys(value).length <= MAX_STATE_TOKEN_KEYS, {
        message: `State token objects may contain at most ${MAX_STATE_TOKEN_KEYS} keys.`,
      }),
  ]);
}

const StateTokenSchema = z
  .record(
    z.string().max(255),
    boundedStateTokenValueSchema(MAX_STATE_TOKEN_DEPTH),
  )
  .refine((value) => Object.keys(value).length <= MAX_STATE_TOKEN_KEYS, {
    message: `State tokens may contain at most ${MAX_STATE_TOKEN_KEYS} keys.`,
  });

const PreparationErrorSchema = z
  .object({
    code: NonEmptyTextSchema,
    message: NonEmptyTextSchema,
  })
  .strict();

const PendingOperationSchema = z
  .object({
    status: z.literal("pending_review"),
    proposal: ProposedOperationSchema,
    resolvedEvidenceRefs: z.array(EvidenceRefSchema).nonempty(),
    stateToken: StateTokenSchema,
  })
  .strict();

const BlockedOperationSchema = z
  .object({
    status: z.literal("blocked"),
    proposal: ProposedOperationSchema,
    preparationError: PreparationErrorSchema,
  })
  .strict();

const OperationInputSchema = z.discriminatedUnion("status", [
  PendingOperationSchema,
  BlockedOperationSchema,
]);

export const BottleCheckCloseReasonSchema = z.enum([
  "dismissed",
  "resolved_manually",
]);

export const CloseBottleCheckInputSchema = z
  .object({
    checkId: PositiveIdSchema,
    reason: BottleCheckCloseReasonSchema,
    note: NonEmptyTextSchema.max(2000).optional(),
  })
  .strict();

export const ListActionableBottleChecksInputSchema = z
  .object({
    cursor: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    origin: AuditBottleOriginSchema.optional(),
  })
  .strict()
  .default({
    cursor: 1,
    limit: 50,
  });

const PersistedBottleCheckOutputSchema = z
  .object({
    findings: z.array(FindingSchema),
  })
  .passthrough();

const StorePriceLinkSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("attempt"),
      attemptId: PositiveIdSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("proposal"),
      proposalId: PositiveIdSchema,
    })
    .strict(),
]);

const CommonCreateFields = {
  backgroundEventKey: NonEmptyTextSchema.max(255).optional(),
  model: NonEmptyTextSchema.nullable().optional(),
  modelMetadata: JsonObjectSchema.nullable().optional(),
  operations: z.array(OperationInputSchema),
} as const;

const CreateBottleCheckInputSchema = z.discriminatedUnion("intent", [
  z
    .object({
      intent: z.literal("resolve_reference"),
      sourceKind: NonEmptyTextSchema,
      sourceId: z.union([NonEmptyTextSchema, z.number().int()]),
      input: ClassifyBottleReferenceInputSchema,
      result: BottleClassificationResultSchema,
      storePrice: StorePriceLinkSchema.optional(),
      ...CommonCreateFields,
    })
    .strict(),
  z
    .object({
      intent: z.literal("audit_bottle"),
      input: AuditBottleInputSchema,
      result: AuditBottleResultSchema,
      ...CommonCreateFields,
    })
    .strict(),
]);

const BottleCheckSubjectSchema = z.discriminatedUnion("intent", [
  z
    .object({
      intent: z.literal("resolve_reference"),
      sourceKind: NonEmptyTextSchema,
      sourceId: z.union([NonEmptyTextSchema, z.number().int()]),
    })
    .strict(),
  z
    .object({
      intent: z.literal("audit_bottle"),
      bottleId: PositiveIdSchema,
    })
    .strict(),
]);

export type CreateBottleCheckInput = z.input<
  typeof CreateBottleCheckInputSchema
>;
export type BottleCheckSubject = z.input<typeof BottleCheckSubjectSchema>;
export type BottleCheckCloseReason = z.infer<
  typeof BottleCheckCloseReasonSchema
>;
export type ListActionableBottleChecksInput = z.input<
  typeof ListActionableBottleChecksInputSchema
>;
export type BottleCheckWithOperations = BottleCheck & {
  operations: BottleOperation[];
};

export type CreateBottleCheckResult = {
  check: BottleCheckWithOperations;
  created: boolean;
};

export type ActionableBottleCheckList = {
  results: BottleCheckWithOperations[];
  rel: {
    nextCursor: number | null;
    prevCursor: number | null;
  };
};

export class BottleCheckCloseAuthorizationError extends Error {
  constructor() {
    super("Moderator authorization is required to close a Bottle check.");
    this.name = "BottleCheckCloseAuthorizationError";
  }
}

export class BottleCheckNotFoundError extends Error {
  constructor(readonly checkId: number) {
    super(`Bottle check ${checkId} was not found.`);
    this.name = "BottleCheckNotFoundError";
  }
}

export class BottleCheckAlreadyClosedError extends Error {
  constructor(readonly checkId: number) {
    super(`Bottle check ${checkId} is already closed.`);
    this.name = "BottleCheckAlreadyClosedError";
  }
}

export class BottleCheckNotClosableError extends Error {
  constructor(
    readonly checkId: number,
    message: string,
  ) {
    super(message);
    this.name = "BottleCheckNotClosableError";
  }
}

function buildSubjectKey(subject: BottleCheckSubject): string {
  if (subject.intent === "audit_bottle") {
    return JSON.stringify([subject.intent, subject.bottleId]);
  }

  return JSON.stringify([
    subject.intent,
    subject.sourceKind,
    String(subject.sourceId),
  ]);
}

function getSubject(
  input: z.infer<typeof CreateBottleCheckInputSchema>,
): BottleCheckSubject {
  if (input.intent === "audit_bottle") {
    return {
      intent: input.intent,
      bottleId: input.input.bottleId,
    };
  }

  return {
    intent: input.intent,
    sourceKind: input.sourceKind,
    sourceId: input.sourceId,
  };
}

const InlineImageDataUrlPattern =
  /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/]*={0,2})$/i;

function sanitizeBottleCheckValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return JsonValueSchema.parse(value);
  }

  if (typeof value === "string") {
    const inlineImage = InlineImageDataUrlPattern.exec(value);
    if (!inlineImage) {
      return value;
    }

    const [, mediaType, encodedBytes] = inlineImage;
    return {
      kind: "omitted_inline_image",
      mediaType: mediaType.toLowerCase(),
      byteLength: Buffer.from(encodedBytes, "base64").byteLength,
    };
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeBottleCheckValue);
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, nestedValue]) =>
        nestedValue === undefined
          ? []
          : [[key, sanitizeBottleCheckValue(nestedValue)]],
      ),
    );
  }

  throw new TypeError(
    `Bottle check input contains unsupported ${typeof value}`,
  );
}

export function sanitizeBottleCheckInput(
  value: unknown,
): Record<string, JsonValue> {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new TypeError("Bottle check input must be an object.");
  }
  return sanitizeBottleCheckValue(value) as Record<string, JsonValue>;
}

function serializedProposalCounts(
  proposals: Array<z.infer<typeof ProposedOperationSchema>>,
) {
  const counts = new Map<string, number>();
  for (const proposal of proposals) {
    const serialized = JSON.stringify(proposal);
    counts.set(serialized, (counts.get(serialized) ?? 0) + 1);
  }
  return counts;
}

function assertOperationsMatchResult({
  operations,
  proposedOperations,
}: {
  operations: Array<z.infer<typeof OperationInputSchema>>;
  proposedOperations: Array<z.infer<typeof ProposedOperationSchema>>;
}) {
  const expected = serializedProposalCounts(proposedOperations);
  const actual = serializedProposalCounts(
    operations.map(({ proposal }) => proposal),
  );

  if (
    expected.size !== actual.size ||
    [...expected].some(
      ([serialized, count]) => actual.get(serialized) !== count,
    )
  ) {
    throw new Error(
      "Persisted Bottle operations must exactly match the check result.",
    );
  }

  for (const operation of operations) {
    if (
      operation.status === "pending_review" &&
      JSON.stringify(operation.resolvedEvidenceRefs) !==
        JSON.stringify(operation.proposal.evidenceRefs)
    ) {
      throw new Error(
        "Persisted resolved evidence references must exactly match the proposal.",
      );
    }
  }
}

function getCollectedSourceFields(
  input: z.infer<typeof CreateBottleCheckInputSchema>,
) {
  if (input.intent === "audit_bottle") {
    return input.input.note === undefined ? [] : ["audit.note"];
  }

  const sourceFields = new Set<string>();
  for (const [field, value] of Object.entries(input.input.reference)) {
    if (value !== null && value !== undefined) {
      sourceFields.add(`reference.${field}`);
    }
  }
  for (const [field, value] of Object.entries(
    input.result.artifacts.extractedIdentity ?? {},
  )) {
    if (value !== null && value !== undefined) {
      sourceFields.add(`extractedIdentity.${field}`);
    }
  }
  for (const field of Object.keys(
    input.result.artifacts.imageEvidence?.fieldCandidates ?? {},
  )) {
    sourceFields.add(`imageEvidence.fieldCandidates.${field}`);
  }
  return [...sourceFields];
}

async function resolveStorePriceLink({
  database,
  storePrice,
}: {
  database: AnyDatabase;
  storePrice?: z.infer<typeof StorePriceLinkSchema>;
}) {
  if (!storePrice) {
    return {
      storePriceMatchAttemptId: null,
      storePriceMatchProposalId: null,
    };
  }

  if (storePrice.kind === "proposal") {
    return {
      storePriceMatchAttemptId: null,
      storePriceMatchProposalId: storePrice.proposalId,
    };
  }

  const attempt = await database.query.storePriceMatchAttempts.findFirst({
    where: eq(storePriceMatchAttempts.id, storePrice.attemptId),
    columns: {
      id: true,
      proposalId: true,
    },
  });
  if (!attempt) {
    throw new Error(
      `Store-price match attempt ${storePrice.attemptId} not found.`,
    );
  }

  return {
    storePriceMatchAttemptId: attempt.id,
    storePriceMatchProposalId: attempt.proposalId,
  };
}

async function findCheckByBackgroundEventKey({
  backgroundEventKey,
  database,
}: {
  backgroundEventKey: string;
  database: AnyDatabase;
}) {
  return await database.query.bottleChecks.findFirst({
    where: eq(bottleChecks.backgroundEventKey, backgroundEventKey),
    with: {
      operations: true,
    },
  });
}

export async function createBottleCheck(
  rawInput: unknown,
  database: AnyDatabase = db,
): Promise<CreateBottleCheckResult> {
  const input = CreateBottleCheckInputSchema.parse(rawInput);
  if (
    input.intent === "audit_bottle" &&
    input.input.origin === "moderator" &&
    input.backgroundEventKey
  ) {
    throw new Error(
      "Moderator Bottle checks must not use a background event key.",
    );
  }
  if (
    input.intent === "audit_bottle" &&
    input.input.origin === "post_user_creation" &&
    !input.backgroundEventKey
  ) {
    throw new Error(
      "Post-user-creation Bottle checks require a background event key.",
    );
  }

  assertOperationsMatchResult({
    operations: input.operations,
    proposedOperations: input.result.proposedOperations,
  });
  assertCollectedEvidenceRefs({
    artifacts: input.result.artifacts,
    evidenceRefs: input.result.findings.flatMap(
      ({ evidenceRefs }) => evidenceRefs,
    ),
    sourceFields: getCollectedSourceFields(input),
  });

  const artifacts = input.result.artifacts;
  const output =
    input.intent === "audit_bottle"
      ? {
          summary: input.result.summary,
          findings: input.result.findings,
        }
      : input.result.status === "ignored"
        ? {
            status: input.result.status,
            reason: input.result.reason,
            findings: input.result.findings,
          }
        : {
            status: input.result.status,
            decision: input.result.decision,
            findings: input.result.findings,
          };
  const subject = getSubject(input);
  const subjectKey = buildSubjectKey(subject);

  return await database.transaction(async (tx) => {
    const storePriceLink =
      input.intent === "resolve_reference"
        ? await resolveStorePriceLink({
            database: tx,
            storePrice: input.storePrice,
          })
        : {
            storePriceMatchAttemptId: null,
            storePriceMatchProposalId: null,
          };

    const [check] = await tx
      .insert(bottleChecks)
      .values({
        intent: input.intent,
        origin:
          input.intent === "audit_bottle" ? input.input.origin : undefined,
        sourceKind:
          input.intent === "resolve_reference" ? input.sourceKind : undefined,
        sourceId:
          input.intent === "resolve_reference"
            ? String(input.sourceId)
            : undefined,
        bottleId:
          input.intent === "audit_bottle" ? input.input.bottleId : undefined,
        subjectKey,
        backgroundEventKey: input.backgroundEventKey,
        schemaVersion: BOTTLE_CHECK_SCHEMA_VERSION,
        inputSnapshot: sanitizeBottleCheckInput(input.input),
        output,
        artifacts,
        model: input.model,
        modelMetadata: input.modelMetadata,
        ...storePriceLink,
        completedAt: new Date(),
      })
      .onConflictDoNothing({
        target: bottleChecks.backgroundEventKey,
      })
      .returning();

    if (!check) {
      const existing = await findCheckByBackgroundEventKey({
        database: tx,
        backgroundEventKey: input.backgroundEventKey as string,
      });
      if (!existing) {
        throw new Error(
          "Bottle check background event conflict could not be resolved.",
        );
      }
      if (existing.subjectKey !== subjectKey) {
        throw new Error(
          "Bottle check background event key belongs to a different subject.",
        );
      }
      return {
        check: existing,
        created: false,
      };
    }

    const operations = input.operations.length
      ? await tx
          .insert(bottleOperations)
          .values(
            input.operations.map((operation) =>
              operation.status === "blocked"
                ? {
                    checkId: check.id,
                    proposal: operation.proposal,
                    preparationError: operation.preparationError,
                    status: operation.status,
                    preparedAt: new Date(),
                  }
                : {
                    checkId: check.id,
                    proposal: operation.proposal,
                    resolvedEvidenceRefs: operation.resolvedEvidenceRefs,
                    stateToken: operation.stateToken,
                    status: operation.status,
                    preparedAt: new Date(),
                  },
            ),
          )
          .returning()
      : [];

    return {
      check: {
        ...check,
        operations,
      },
      created: true,
    };
  });
}

export async function getBottleCheckHistory(
  rawSubject: unknown,
  database: AnyDatabase = db,
): Promise<BottleCheckWithOperations[]> {
  const subject = BottleCheckSubjectSchema.parse(rawSubject);
  return await database.query.bottleChecks.findMany({
    where: eq(bottleChecks.subjectKey, buildSubjectKey(subject)),
    orderBy: [desc(bottleChecks.createdAt), desc(bottleChecks.id)],
    with: {
      operations: true,
    },
  });
}

export async function getLatestBottleCheck(
  rawSubject: unknown,
  database: AnyDatabase = db,
): Promise<BottleCheckWithOperations | null> {
  const subject = BottleCheckSubjectSchema.parse(rawSubject);
  return (
    (await database.query.bottleChecks.findFirst({
      where: eq(bottleChecks.subjectKey, buildSubjectKey(subject)),
      orderBy: [desc(bottleChecks.createdAt), desc(bottleChecks.id)],
      with: {
        operations: true,
      },
    })) ?? null
  );
}

export async function listActionableBottleChecks(
  rawInput: unknown = {},
  database: AnyDatabase = db,
): Promise<ActionableBottleCheckList> {
  const input = ListActionableBottleChecksInputSchema.parse(rawInput);
  const offset = (input.cursor - 1) * input.limit;
  const hasFindings = sql<boolean>`jsonb_array_length(COALESCE(${bottleChecks.output}->'findings', '[]'::jsonb)) > 0`;
  const hasActionableOperation = exists(
    database
      .select({ id: bottleOperations.id })
      .from(bottleOperations)
      .where(
        and(
          eq(bottleOperations.checkId, bottleChecks.id),
          inArray(bottleOperations.status, [
            "blocked",
            "pending_review",
            "applying",
            "stale",
            "failed",
          ]),
        ),
      ),
  );
  const rows = await database
    .select()
    .from(bottleChecks)
    .where(
      and(
        eq(bottleChecks.intent, "audit_bottle"),
        isNull(bottleChecks.closedAt),
        input.origin ? eq(bottleChecks.origin, input.origin) : undefined,
        or(hasFindings, hasActionableOperation),
      ),
    )
    .orderBy(desc(bottleChecks.createdAt), desc(bottleChecks.id))
    .limit(input.limit + 1)
    .offset(offset);
  const hasNextPage = rows.length > input.limit;
  const page = rows.slice(0, input.limit);
  const operations = page.length
    ? await database
        .select()
        .from(bottleOperations)
        .where(
          inArray(
            bottleOperations.checkId,
            page.map(({ id }) => id),
          ),
        )
        .orderBy(bottleOperations.id)
    : [];
  const operationsByCheckId = Map.groupBy(
    operations,
    (operation) => operation.checkId,
  );

  return {
    results: page.map((check) => ({
      ...check,
      operations: operationsByCheckId.get(check.id) ?? [],
    })),
    rel: {
      nextCursor: hasNextPage ? input.cursor + 1 : null,
      prevCursor: input.cursor > 1 ? input.cursor - 1 : null,
    },
  };
}

export async function getBottleCheckForReview(
  rawCheckId: unknown,
  database: AnyDatabase = db,
): Promise<BottleCheckWithOperations | null> {
  const checkId = PositiveIdSchema.parse(rawCheckId);
  return (
    (await database.query.bottleChecks.findFirst({
      where: eq(bottleChecks.id, checkId),
      with: {
        operations: {
          orderBy: [bottleOperations.id],
        },
      },
    })) ?? null
  );
}

export async function closeBottleCheck(
  rawInput: unknown,
  user: User | null,
  database: AnyConnection = db,
): Promise<BottleCheckWithOperations> {
  if (!user?.admin && !user?.mod) {
    throw new BottleCheckCloseAuthorizationError();
  }
  const input = CloseBottleCheckInputSchema.parse(rawInput);

  return await database.transaction(async (tx) => {
    const [check] = await tx
      .select()
      .from(bottleChecks)
      .where(eq(bottleChecks.id, input.checkId))
      .limit(1)
      .for("update");
    if (!check) {
      throw new BottleCheckNotFoundError(input.checkId);
    }
    if (check.closedAt !== null) {
      throw new BottleCheckAlreadyClosedError(check.id);
    }

    const operations = await tx
      .select()
      .from(bottleOperations)
      .where(eq(bottleOperations.checkId, check.id))
      .orderBy(bottleOperations.id);
    if (
      operations.some(
        ({ status }) => status === "pending_review" || status === "applying",
      )
    ) {
      throw new BottleCheckNotClosableError(
        check.id,
        `Bottle check ${check.id} still has pending or applying operations.`,
      );
    }

    const findings =
      check.output === null
        ? []
        : PersistedBottleCheckOutputSchema.parse(check.output).findings;
    const hasClosableOperation = operations.some(({ status }) =>
      ["blocked", "stale", "failed"].includes(status),
    );
    if (findings.length === 0 && !hasClosableOperation) {
      throw new BottleCheckNotClosableError(
        check.id,
        `Bottle check ${check.id} has no remaining work to close.`,
      );
    }

    const [closed] = await tx
      .update(bottleChecks)
      .set({
        closedAt: sql`NOW()`,
        closedById: user.id,
        closeReason: input.reason,
        closeNote: input.note ?? null,
      })
      .where(and(eq(bottleChecks.id, check.id), isNull(bottleChecks.closedAt)))
      .returning();
    if (!closed) {
      throw new BottleCheckAlreadyClosedError(check.id);
    }

    return {
      ...closed,
      operations,
    };
  });
}
