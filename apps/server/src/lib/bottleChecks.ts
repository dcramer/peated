import {
  AuditBottleInputSchema,
  AuditBottleOriginSchema,
  AuditBottleResultSchema,
  BottleClassificationResultSchema,
  BottleClassifierRunMetadataSchema,
  ClassifyBottleReferenceInputSchema,
  DecidedBottleClassificationResultSchema,
  FindingSchema,
  getBottleCheckSourceEvidencePaths,
  IgnoredBottleClassificationResultSchema,
  type BottleClassificationArtifacts,
  type EvidenceRef,
} from "@peated/bottle-classifier";
import { db, type AnyConnection, type AnyDatabase } from "@peated/server/db";
import {
  bottleCheckCloseReasonEnum,
  bottleChecks,
  bottleOperations,
  storePriceMatchAttempts,
  storePriceMatchProposals,
  type BottleCheck,
  type BottleOperation,
  type User,
} from "@peated/server/db/schema";
import {
  BOTTLE_CHECK_SCHEMA_VERSION,
  isSupportedBottleCheckSchemaVersion,
} from "@peated/server/lib/bottleCheckSchemaVersion";
import {
  assertCollectedEvidenceRefs,
  prepareProposals,
} from "@peated/server/lib/bottleOperationReview";
import {
  and,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";

export { BOTTLE_CHECK_SCHEMA_VERSION } from "@peated/server/lib/bottleCheckSchemaVersion";

const NonEmptyTextSchema = z.string().trim().min(1);

function assertFindingContextEvidenceRefs(
  artifacts: BottleClassificationArtifacts,
  evidenceRefs: readonly EvidenceRef[],
) {
  const inspectedBottleIds = new Set(
    artifacts.bottleContexts.map(({ bottleId }) => bottleId),
  );
  const inspectedEntityIds = new Set(
    artifacts.entityContexts.map(({ entityId }) => entityId),
  );

  for (const evidenceRef of evidenceRefs) {
    if (
      evidenceRef.kind === "bottle" &&
      !inspectedBottleIds.has(evidenceRef.bottleId)
    ) {
      throw new Error(
        `Finding Bottle evidence must reference an inspected Bottle context: ${evidenceRef.bottleId}.`,
      );
    }
    if (
      evidenceRef.kind === "entity" &&
      !inspectedEntityIds.has(evidenceRef.entityId)
    ) {
      throw new Error(
        `Finding Entity evidence must reference an inspected Entity context: ${evidenceRef.entityId}.`,
      );
    }
  }
}

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

export const BottleCheckCloseReasonSchema = z.enum(
  bottleCheckCloseReasonEnum.enumValues,
);

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
    source: z
      .enum(["incoming_listing", "moderator", "new_bottle", "photo_scan"])
      .optional(),
  })
  .strict()
  .default({
    cursor: 1,
    limit: 50,
  });

export const PersistedAuditBottleCheckOutputSchema =
  AuditBottleResultSchema.omit({
    proposedOperations: true,
    artifacts: true,
  });

const CurrentPersistedReferenceBottleCheckOutputSchema = z.discriminatedUnion(
  "status",
  [
    IgnoredBottleClassificationResultSchema.omit({ artifacts: true }).extend({
      // Version 2 reference checks can contain findings from the former
      // combined identity-and-review agent. New reference checks write none.
      findings: z.array(FindingSchema).default([]),
    }),
    DecidedBottleClassificationResultSchema.omit({ artifacts: true }).extend({
      findings: z.array(FindingSchema).default([]),
    }),
  ],
);

function removeLegacyClassifierOutputFields(output: unknown): unknown {
  if (!output || typeof output !== "object") return output;

  const decision = (output as Record<string, unknown>).decision;
  if (!decision || typeof decision !== "object") return output;

  const { identityBasis: _identityBasis, ...decisionWithoutIdentityBasis } =
    decision as Record<string, unknown>;
  let currentDecision = decisionWithoutIdentityBasis;
  const observation = currentDecision.observation;
  if (observation && typeof observation === "object") {
    const {
      bottleNumber: _bottleNumber,
      outturn: _outturn,
      market: _market,
      exclusive: _exclusive,
      ...currentObservation
    } = observation as Record<string, unknown>;
    currentDecision = {
      ...currentDecision,
      observation: currentObservation,
    };
  }

  const confidenceBasis = currentDecision.confidenceBasis;
  if (!confidenceBasis || typeof confidenceBasis !== "object") {
    return { ...output, decision: currentDecision };
  }

  const {
    positiveEvidence: _positiveEvidence,
    toolsUsed: _toolsUsed,
    ...currentConfidenceBasis
  } = confidenceBasis as Record<string, unknown>;
  return {
    ...output,
    decision: {
      ...currentDecision,
      confidenceBasis: currentConfidenceBasis,
    },
  };
}

// Version 2 decisions can contain obsolete model output. Drop fields with no
// current reader before current strict validation; runtime metadata owns actual
// tool calls.
export const PersistedReferenceBottleCheckOutputSchema = z.preprocess(
  removeLegacyClassifierOutputFields,
  CurrentPersistedReferenceBottleCheckOutputSchema,
);

export const PersistedBottleCheckOutputSchema = z.union([
  PersistedAuditBottleCheckOutputSchema,
  PersistedReferenceBottleCheckOutputSchema,
]);

const StorePriceAttemptLinkSchema = z
  .object({
    attemptId: PositiveIdSchema,
  })
  .strict();

const CommonCreateFields = {
  backgroundEventKey: NonEmptyTextSchema.max(255).optional(),
  model: NonEmptyTextSchema.nullable().optional(),
  modelMetadata: BottleClassifierRunMetadataSchema.nullable().optional(),
} as const;

const CreateBottleCheckInputSchema = z.discriminatedUnion("intent", [
  z
    .object({
      intent: z.literal("resolve_reference"),
      sourceKind: NonEmptyTextSchema,
      sourceId: z.union([NonEmptyTextSchema, z.number().int()]),
      input: ClassifyBottleReferenceInputSchema,
      result: BottleClassificationResultSchema,
      storePrice: StorePriceAttemptLinkSchema.optional(),
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

function buildPersistedBottleCheckOutput(
  input: z.infer<typeof CreateBottleCheckInputSchema>,
) {
  if (input.intent === "audit_bottle") {
    const {
      artifacts: _artifacts,
      proposedOperations: _proposedOperations,
      ...output
    } = input.result;
    return PersistedAuditBottleCheckOutputSchema.parse(output);
  }

  const { artifacts: _artifacts, ...output } = input.result;
  return PersistedReferenceBottleCheckOutputSchema.parse({
    ...output,
    findings: [],
  });
}

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

const ACTIONABLE_OPERATION_STATUS_VALUES: BottleOperation["status"][] = [
  "blocked",
  "pending_review",
  "applying",
  "stale",
  "failed",
];

const ACTIONABLE_OPERATION_STATUSES = new Set(
  ACTIONABLE_OPERATION_STATUS_VALUES,
);

const TERMINAL_OPERATION_STATUSES = new Set<BottleOperation["status"]>([
  "applied",
  "rejected",
]);

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

async function resolveStorePriceLink({
  database,
  storePrice,
  sourceId,
}: {
  database: AnyDatabase;
  storePrice: z.infer<typeof StorePriceAttemptLinkSchema>;
  sourceId: string | number;
}) {
  const attempt = await database.query.storePriceMatchAttempts.findFirst({
    where: eq(storePriceMatchAttempts.id, storePrice.attemptId),
    columns: {
      id: true,
      priceId: true,
      proposalId: true,
      suggestedBottleId: true,
    },
  });
  if (!attempt) {
    throw new Error(
      `Store-price match attempt ${storePrice.attemptId} not found.`,
    );
  }
  if (String(attempt.priceId) !== String(sourceId)) {
    throw new Error(
      `Store-price match attempt ${storePrice.attemptId} does not belong to price ${sourceId}.`,
    );
  }

  return {
    storePriceMatchAttemptId: attempt.id,
    storePriceMatchProposalId: attempt.proposalId,
    suggestedBottleId: attempt.suggestedBottleId,
  };
}

function getProtectedBottleIds(
  input: z.infer<typeof CreateBottleCheckInputSchema>,
  storePriceSuggestedBottleId: number | null,
): number[] {
  if (input.intent === "audit_bottle") return [];
  if (input.sourceKind === "store_price") {
    return storePriceSuggestedBottleId === null
      ? []
      : [storePriceSuggestedBottleId];
  }
  if (input.result.status === "ignored") return [];

  const { decision } = input.result;
  return decision.action === "match" ? [decision.matchedBottleId] : [];
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
  if (input.intent === "resolve_reference") {
    if (input.sourceKind === "store_price" && !input.storePrice) {
      throw new Error(
        "Store-price Bottle checks require the exact match attempt.",
      );
    }
    if (input.sourceKind !== "store_price" && input.storePrice) {
      throw new Error(
        "Only store-price Bottle checks may link a match attempt.",
      );
    }
  }
  const findings = input.intent === "audit_bottle" ? input.result.findings : [];
  const proposedOperations =
    input.intent === "audit_bottle" ? input.result.proposedOperations : [];
  const findingEvidenceRefs = findings.flatMap(
    ({ evidenceRefs }) => evidenceRefs,
  );
  const evidenceSource = {
    ...input,
    artifacts: input.result.artifacts,
  };
  const sourceFields = getBottleCheckSourceEvidencePaths(evidenceSource);
  assertCollectedEvidenceRefs({
    artifacts: input.result.artifacts,
    evidenceRefs: findingEvidenceRefs,
    sourceFields,
  });
  assertFindingContextEvidenceRefs(input.result.artifacts, findingEvidenceRefs);
  const artifacts = input.result.artifacts;
  const output = buildPersistedBottleCheckOutput(input);
  const subject = getSubject(input);
  const subjectKey = buildSubjectKey(subject);

  return await database.transaction(async (tx) => {
    const resolvedStorePriceLink =
      input.intent === "resolve_reference" && input.storePrice
        ? await resolveStorePriceLink({
            database: tx,
            storePrice: input.storePrice,
            sourceId: input.sourceId,
          })
        : {
            storePriceMatchAttemptId: null,
            storePriceMatchProposalId: null,
            suggestedBottleId: null,
          };
    const { suggestedBottleId, ...storePriceLink } = resolvedStorePriceLink;
    const operations = await prepareProposals({
      proposals: proposedOperations,
      artifacts: input.result.artifacts,
      sourceFields,
      protectedBottleIds: getProtectedBottleIds(input, suggestedBottleId),
      database: tx,
    });

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

    const insertedOperations = operations.length
      ? await tx
          .insert(bottleOperations)
          .values(
            operations.map((operation) =>
              operation.status === "blocked"
                ? {
                    checkId: check.id,
                    proposal: operation.proposal,
                    preparationError: operation.preparationError,
                    status: operation.status,
                  }
                : {
                    checkId: check.id,
                    proposal: operation.proposal,
                    stateToken: operation.stateToken,
                    status: operation.status,
                  },
            ),
          )
          .returning()
      : [];

    return {
      check: {
        ...check,
        operations: insertedOperations,
      },
      created: true,
    };
  });
}

function getPersistedCheckFindings(check: BottleCheck): unknown[] | null {
  if (!isSupportedBottleCheckSchemaVersion(check) || check.output === null) {
    return null;
  }

  return PersistedBottleCheckOutputSchema.parse(check.output).findings;
}

export async function getCurrentModeratorBottleAudit(
  rawBottleId: unknown,
  database: AnyDatabase = db,
): Promise<BottleCheckWithOperations | null> {
  const bottleId = PositiveIdSchema.parse(rawBottleId);
  const checks = await database.query.bottleChecks.findMany({
    where: and(
      eq(bottleChecks.intent, "audit_bottle"),
      eq(bottleChecks.origin, "moderator"),
      eq(bottleChecks.bottleId, bottleId),
      isNull(bottleChecks.closedAt),
    ),
    orderBy: [desc(bottleChecks.createdAt), desc(bottleChecks.id)],
    with: {
      operations: true,
    },
  });

  return (
    checks.find((check) => {
      const findings = getPersistedCheckFindings(check);
      return (
        findings === null ||
        findings.length > 0 ||
        check.operations.some(({ status }) =>
          ACTIONABLE_OPERATION_STATUSES.has(status),
        )
      );
    }) ?? null
  );
}

export async function deleteTerminalModeratorBottleAudits(
  {
    bottleId: rawBottleId,
    exceptCheckId: rawExceptCheckId,
  }: {
    bottleId: unknown;
    exceptCheckId?: unknown;
  },
  database: AnyDatabase = db,
): Promise<void> {
  const bottleId = PositiveIdSchema.parse(rawBottleId);
  const exceptCheckId =
    rawExceptCheckId === undefined
      ? undefined
      : PositiveIdSchema.parse(rawExceptCheckId);
  const checks = await database.query.bottleChecks.findMany({
    where: and(
      eq(bottleChecks.intent, "audit_bottle"),
      eq(bottleChecks.origin, "moderator"),
      eq(bottleChecks.bottleId, bottleId),
      exceptCheckId === undefined
        ? undefined
        : ne(bottleChecks.id, exceptCheckId),
    ),
    with: {
      operations: true,
    },
  });
  const terminalCheckIds = checks
    .filter((check) => {
      if (
        !check.operations.every(({ status }) =>
          TERMINAL_OPERATION_STATUSES.has(status),
        )
      ) {
        return false;
      }

      const findings = getPersistedCheckFindings(check);
      return check.closedAt !== null || findings?.length === 0;
    })
    .map(({ id }) => id);

  if (terminalCheckIds.length > 0) {
    await database
      .delete(bottleChecks)
      .where(inArray(bottleChecks.id, terminalCheckIds));
  }
}

export async function listActionableBottleChecks(
  rawInput: unknown = {},
  database: AnyDatabase = db,
): Promise<ActionableBottleCheckList> {
  const input = ListActionableBottleChecksInputSchema.parse(rawInput);
  const offset = (input.cursor - 1) * input.limit;
  const hasFindings = sql<boolean>`CASE
    WHEN jsonb_typeof(${bottleChecks.output}->'findings') = 'array'
    THEN jsonb_array_length(${bottleChecks.output}->'findings') > 0
    ELSE false
  END`;
  const hasActionableOperation = exists(
    database
      .select({ id: bottleOperations.id })
      .from(bottleOperations)
      .where(
        and(
          eq(bottleOperations.checkId, bottleChecks.id),
          inArray(bottleOperations.status, ACTIONABLE_OPERATION_STATUS_VALUES),
        ),
      ),
  );
  // Store-price checks become Bottle Checks work only after the listing queue
  // has finished its authoritative assignment decision.
  const completedStorePriceCheck = and(
    eq(bottleChecks.intent, "resolve_reference"),
    eq(bottleChecks.sourceKind, "store_price"),
    exists(
      database
        .select({ id: storePriceMatchProposals.id })
        .from(storePriceMatchProposals)
        .where(
          and(
            eq(
              storePriceMatchProposals.id,
              bottleChecks.storePriceMatchProposalId,
            ),
            inArray(storePriceMatchProposals.status, [
              "approved",
              "ignored",
              "verified",
            ]),
          ),
        ),
    ),
  );
  let sourceFilter = or(
    eq(bottleChecks.intent, "audit_bottle"),
    and(
      eq(bottleChecks.intent, "resolve_reference"),
      eq(bottleChecks.sourceKind, "photo_identification"),
    ),
    completedStorePriceCheck,
  );
  switch (input.source) {
    case "incoming_listing":
      sourceFilter = completedStorePriceCheck;
      break;
    case "moderator":
      sourceFilter = and(
        eq(bottleChecks.intent, "audit_bottle"),
        eq(bottleChecks.origin, "moderator"),
      );
      break;
    case "new_bottle":
      sourceFilter = and(
        eq(bottleChecks.intent, "audit_bottle"),
        eq(bottleChecks.origin, "post_user_creation"),
      );
      break;
    case "photo_scan":
      sourceFilter = and(
        eq(bottleChecks.intent, "resolve_reference"),
        eq(bottleChecks.sourceKind, "photo_identification"),
      );
      break;
    case undefined:
      break;
  }
  const rows = await database
    .select()
    .from(bottleChecks)
    .where(
      and(
        sourceFilter,
        isNull(bottleChecks.closedAt),
        or(
          ne(bottleChecks.schemaVersion, BOTTLE_CHECK_SCHEMA_VERSION),
          hasFindings,
          hasActionableOperation,
        ),
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
    const schemaSupported = isSupportedBottleCheckSchemaVersion(check);
    if (
      operations.some(
        ({ status }) =>
          status === "applying" ||
          (schemaSupported && status === "pending_review"),
      )
    ) {
      throw new BottleCheckNotClosableError(
        check.id,
        `Bottle check ${check.id} still has pending or applying operations.`,
      );
    }

    if (schemaSupported) {
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
