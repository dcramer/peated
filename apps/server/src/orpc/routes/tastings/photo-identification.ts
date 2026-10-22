// This route owns the photo lookup boundary for add-tasting. It may create or
// reuse a pending upload, but it must not create tastings, bottles, or durable
// classifier trace rows.
import config from "@peated/server/config";
import { MAX_FILESIZE } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { logError } from "@peated/server/lib/log";
import { isModelServiceUnavailable } from "@peated/server/lib/openaiClient";
import { createPendingImageUpload } from "@peated/server/lib/pendingUploads";
import {
  getClassificationLogAttributes,
  getImageEvidenceFieldAttributes,
  identifyBottlePhoto,
  isPhotoIdentificationCreateDecisionAutoCreatable,
  PHOTO_IDENTIFICATION_RATE_LIMIT,
  serializeProposedBottle,
  type PhotoIdentificationAttributes,
  type PhotoIdentificationClassification,
  type PhotoIdentificationModelMetadata,
  type PhotoIdentificationProgress,
} from "@peated/server/lib/photoIdentification";
import { signPhotoIdentificationCreateToken } from "@peated/server/lib/photoIdentificationCreateToken";
import { humanizeBytes } from "@peated/server/lib/strings";
import { logInfo } from "@peated/server/lib/structuredLog";
import { compressAndResizeImage } from "@peated/server/lib/uploads";
import { absoluteUrl } from "@peated/server/lib/urls";
import { implement } from "@peated/server/orpc";
import type { Context } from "@peated/server/orpc/context";
import photoIdentificationContract from "@peated/server/orpc/contracts/tastings/photo-identification";
import {
  createRateLimit,
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import {
  type PhotoIdentificationDiagnosticsSchema,
  type PhotoIdentificationProgressSchema,
  type PhotoIdentificationSchema,
  type PhotoIdentificationSuggestedNextStepEnum,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import type { z } from "zod";

type AuthenticatedContext = Context & {
  user: NonNullable<Context["user"]>;
};
/** Writes one photo lookup outcome log line. */
type PhotoIdentificationLog = (
  attributes: PhotoIdentificationAttributes,
) => void;

export type PhotoIdentificationProcedureServices = {
  logOutcome: PhotoIdentificationLog;
  createPendingImage: typeof createPendingImageUpload;
  identifyImage: typeof identifyBottlePhoto;
};

const PHOTO_IDENTIFICATION_LOG_MESSAGE =
  "Bottle photo identification completed";

const photoIdentificationRateLimit = createRateLimit<AuthenticatedContext>(
  PHOTO_IDENTIFICATION_RATE_LIMIT,
);

/**
 * Strips server-owned classifier internals from the browser response while
 * preserving the fields the photo tasting flow needs to continue.
 */
async function serializePhotoIdentificationClassification(
  classification: PhotoIdentificationClassification,
): Promise<z.infer<typeof PhotoIdentificationSchema>["classification"]> {
  const artifacts = {
    candidates: classification.artifacts.candidates.map((candidate) => ({
      fullName: candidate.fullName,
    })),
  };

  if (classification.status === "ignored") {
    return {
      status: "ignored",
      reason: classification.reason,
      artifacts,
    };
  }

  const { decision } = classification;
  type SerializedDecision = Extract<
    z.infer<typeof PhotoIdentificationSchema>["classification"],
    { status: "classified" }
  >["decision"];
  let serializedDecision: SerializedDecision;

  switch (decision.action) {
    case "match": {
      const bottleId = decision.matchedBottleId;

      const matchedBottle = await db.query.bottles.findFirst({
        where: (bottles, { eq }) => eq(bottles.id, bottleId),
      });
      const tombstone = await db.query.bottleTombstones.findFirst({
        columns: { bottleId: true },
        where: (tombstones, { eq }) => eq(tombstones.bottleId, bottleId),
      });
      if (!matchedBottle || tombstone) {
        throw new Error("Photo identification match is not an active Bottle.");
      }

      serializedDecision = {
        action: "match",
        matchedBottle: await serialize(
          BottleSerializer,
          matchedBottle,
          undefined,
          [],
          { includeGroupSummary: true },
        ),
      };
      break;
    }
    case "create_bottle":
      serializedDecision = {
        action: "create_bottle",
        proposedBottle: serializeProposedBottle(decision.proposedBottle),
      };
      break;
    case "no_match":
      serializedDecision = {
        action: "no_match",
      };
      break;
  }

  return {
    status: "classified",
    decision: serializedDecision,
    artifacts,
  };
}

function getSearchEvidenceLogAttributes(
  prefix: string,
  classification: PhotoIdentificationClassification,
) {
  const searchEvidence = classification.artifacts.searchEvidence;
  const resultSummaries = searchEvidence.flatMap((evidence) =>
    evidence.results.map((result) =>
      [result.title, getSearchResultDomain(result)].filter(Boolean).join(" - "),
    ),
  );

  return {
    [`${prefix}.search_evidence_count`]: searchEvidence.length,
    [`${prefix}.search_evidence_result_count`]: resultSummaries.length,
    [`${prefix}.search_queries`]: searchEvidence
      .map((evidence) => evidence.query)
      .slice(0, 5),
    [`${prefix}.search_result_summaries`]: resultSummaries.slice(0, 5),
  };
}

function getSearchResultDomain({
  domain,
  url,
}: {
  domain?: string | null;
  url: string;
}) {
  if (domain) return domain;

  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Emits one searchable event for each completed photo identification call so
 * production misses can be debugged without reconstructing classifier spans.
 */
function logPhotoIdentificationOutcome({
  log,
  context,
  pendingImage,
  idempotencyKey,
  file,
  referenceName,
  imageEvidence,
  classification,
  modelMetadata,
  diagnostics,
  suggestedNextStep,
}: {
  log: PhotoIdentificationLog;
  context: AuthenticatedContext;
  pendingImage: Awaited<ReturnType<typeof createPendingImageUpload>>;
  idempotencyKey: string;
  file: Blob;
  referenceName: string;
  imageEvidence: z.infer<typeof PhotoIdentificationSchema>["imageEvidence"];
  classification: PhotoIdentificationClassification;
  modelMetadata: PhotoIdentificationModelMetadata;
  diagnostics: z.infer<typeof PhotoIdentificationDiagnosticsSchema>;
  suggestedNextStep: z.infer<typeof PhotoIdentificationSuggestedNextStepEnum>;
}) {
  const attrs: PhotoIdentificationAttributes = {
    "photo_identification.user_id": context.user.id,
    "photo_identification.pending_image_id": pendingImage.id,
    "photo_identification.idempotency_key": idempotencyKey,
    "photo_identification.outcome": "completed",
    "photo_identification.file_size": file.size,
    "photo_identification.file_type": file.type || "unknown",
    "photo_identification.reference_name": referenceName,
    "photo_identification.suggested_next_step": suggestedNextStep,
    "photo_identification.extraction_status": diagnostics.extraction.status,
    "photo_identification.candidate_count": diagnostics.candidates.count,
    "photo_identification.is_single_bottle_photo":
      imageEvidence.photoSuitability.isSingleBottlePhoto,
    "photo_identification.label_readable":
      imageEvidence.photoSuitability.labelReadable,
    "photo_identification.suitable_as_tasting_image":
      imageEvidence.photoSuitability.suitableAsTastingImage,
    "photo_identification.suitable_as_bottle_image":
      imageEvidence.photoSuitability.suitableAsBottleImage,
    ...getClassificationLogAttributes(
      "photo_identification.final",
      classification,
      modelMetadata,
    ),
    ...getSearchEvidenceLogAttributes(
      "photo_identification.final",
      classification,
    ),
  };

  if (diagnostics.extraction.summary) {
    attrs["photo_identification.extraction_summary"] =
      diagnostics.extraction.summary;
  }

  Object.assign(attrs, getImageEvidenceFieldAttributes(imageEvidence));

  log(attrs);
}

function logPhotoIdentificationRejected({
  log,
  context,
  idempotencyKey,
  file,
  outcome,
  reason,
}: {
  log: PhotoIdentificationLog;
  context: AuthenticatedContext;
  idempotencyKey: string;
  file: Blob;
  outcome: string;
  reason: string;
}) {
  log({
    "photo_identification.user_id": context.user.id,
    "photo_identification.idempotency_key": idempotencyKey,
    "photo_identification.outcome": outcome,
    "photo_identification.file_size": file.size,
    "photo_identification.file_type": file.type || "unknown",
    "photo_identification.error_message": reason,
  });
}

function logPhotoIdentificationCancelled({
  log,
  context,
  pendingImage,
  idempotencyKey,
  file,
}: {
  log: PhotoIdentificationLog;
  context: AuthenticatedContext;
  pendingImage: PendingImage;
  idempotencyKey: string;
  file: Blob;
}) {
  log({
    "photo_identification.user_id": context.user.id,
    "photo_identification.pending_image_id": pendingImage.id,
    "photo_identification.idempotency_key": idempotencyKey,
    "photo_identification.outcome": "cancelled",
    "photo_identification.file_size": file.size,
    "photo_identification.file_type": file.type || "unknown",
  });
}

function logPhotoIdentificationFailure({
  log,
  context,
  pendingImage,
  idempotencyKey,
  file,
  err,
}: {
  log: PhotoIdentificationLog;
  context: AuthenticatedContext;
  pendingImage: Awaited<ReturnType<typeof createPendingImageUpload>>;
  idempotencyKey: string;
  file: Blob;
  err: unknown;
}) {
  const error = err instanceof Error ? err : null;
  log({
    "photo_identification.user_id": context.user.id,
    "photo_identification.pending_image_id": pendingImage.id,
    "photo_identification.idempotency_key": idempotencyKey,
    "photo_identification.outcome": "failed",
    "photo_identification.file_size": file.size,
    "photo_identification.file_type": file.type || "unknown",
    "photo_identification.error_name": error?.name ?? "NonErrorThrown",
    "photo_identification.retryable":
      error !== null && isModelServiceUnavailable(error),
  });
}

const photoIdentificationProcedureServices: PhotoIdentificationProcedureServices =
  {
    createPendingImage: createPendingImageUpload,
    identifyImage: identifyBottlePhoto,
    logOutcome: (attributes) =>
      logInfo(PHOTO_IDENTIFICATION_LOG_MESSAGE, attributes),
  };

export function createPhotoIdentificationProcedure(
  services: PhotoIdentificationProcedureServices = photoIdentificationProcedureServices,
) {
  return implement(photoIdentificationContract)
    .use(requireAuth)
    .use(requireTosAccepted)
    .use(photoIdentificationRateLimit)
    .handler(async function ({
      input,
      context,
      errors,
      signal: requestSignal,
    }) {
      const { file, idempotencyKey } = input;

      if (file.size > MAX_FILESIZE) {
        logPhotoIdentificationRejected({
          log: services.logOutcome,
          context,
          idempotencyKey,
          file,
          outcome: "rejected",
          reason: `File exceeded maximum upload size of ${humanizeBytes(MAX_FILESIZE)}.`,
        });
        throw errors.PAYLOAD_TOO_LARGE({
          message: `File exceeded maximum upload size of ${humanizeBytes(MAX_FILESIZE)}.`,
        });
      }

      let pendingImage: PendingImage;
      try {
        pendingImage = await services.createPendingImage({
          file,
          purpose: "photo_tasting_entry",
          idempotencyKey,
          createdById: context.user.id,
          onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
        });
      } catch (err) {
        const error = err instanceof Error ? err : null;
        logPhotoIdentificationRejected({
          log: services.logOutcome,
          context,
          idempotencyKey,
          file,
          outcome: "failed",
          reason:
            error?.message ??
            "Unable to create pending image for photo identification.",
        });
        throw errors.INTERNAL_SERVER_ERROR({
          message: "Unable to process bottle photo.",
          cause: err,
        });
      }

      // Errors above are ordinary responses. Everything below runs while the
      // response streams, where the RPC error middleware can no longer see it.
      return streamPhotoIdentification({
        services,
        context,
        toIdentificationError: (err) =>
          isModelServiceUnavailable(err)
            ? errors.SERVICE_UNAVAILABLE({ cause: err })
            : errors.INTERNAL_SERVER_ERROR({
                message: "Unable to identify bottle from photo.",
                cause: err,
              }),
        requestSignal,
        pendingImage,
        idempotencyKey,
        file,
      });
    });
}

type PendingImage = Awaited<ReturnType<typeof createPendingImageUpload>>;

type PhotoIdentificationCandidates = Extract<
  PhotoIdentificationProgress,
  { type: "candidates" }
>["candidates"];

/**
 * Runs label reading and classification for one stored photo, yielding
 * progress as it happens and returning the full result. Ending the stream
 * early, by a member picking a match or leaving, stops the remaining work.
 */
async function* streamPhotoIdentification({
  services,
  context,
  toIdentificationError,
  requestSignal,
  pendingImage,
  idempotencyKey,
  file,
}: {
  services: PhotoIdentificationProcedureServices;
  context: AuthenticatedContext;
  toIdentificationError: (err: Error) => Error;
  requestSignal: AbortSignal | undefined;
  pendingImage: PendingImage;
  idempotencyKey: string;
  file: Blob;
}): AsyncGenerator<
  z.infer<typeof PhotoIdentificationProgressSchema>,
  z.infer<typeof PhotoIdentificationSchema>
> {
  const serializedPendingImage = {
    id: pendingImage.id,
    imageUrl: absoluteUrl(config.API_SERVER, pendingImage.imageUrl),
    expiresAt: pendingImage.expiresAt.toISOString(),
  };
  const stop = new AbortController();
  const stopOnDisconnect = () => stop.abort();
  requestSignal?.addEventListener("abort", stopOnDisconnect, { once: true });
  const progress = createProgressQueue<PhotoIdentificationProgress>();
  const identification = services.identifyImage({
    photo: pendingImage,
    traceAttributes: {
      "photo_identification.pending_image_id": pendingImage.id,
    },
    signal: stop.signal,
    onProgress: progress.push,
  });
  identification.then(progress.close, progress.close);
  // True once identification finished or failed on its own; anything else that
  // ends the stream is a cancellation.
  let settled = false;

  try {
    yield { type: "photo", pendingImage: serializedPendingImage };
    for await (const event of progress) {
      yield await serializePhotoIdentificationProgress(event);
    }

    let result: Awaited<ReturnType<typeof identifyBottlePhoto>>;
    try {
      result = await identification;
    } catch (err) {
      if (stop.signal.aborted) throw err;
      settled = true;
      logPhotoIdentificationFailure({
        log: services.logOutcome,
        context,
        pendingImage,
        idempotencyKey,
        file,
        err,
      });
      const error =
        err instanceof Error
          ? err
          : new Error("Photo identification failed.", { cause: err });
      // The RPC error middleware cannot see errors raised mid-stream.
      logError(error);
      throw toIdentificationError(error);
    }
    settled = true;

    const {
      imageEvidence,
      classification,
      modelMetadata,
      referenceName,
      diagnostics,
      suggestedNextStep,
    } = result;
    logPhotoIdentificationOutcome({
      log: services.logOutcome,
      context,
      pendingImage,
      idempotencyKey,
      file,
      referenceName,
      imageEvidence,
      classification,
      modelMetadata,
      diagnostics,
      suggestedNextStep,
    });
    const createToken =
      classification.status === "classified" &&
      suggestedNextStep === "confirm_create" &&
      isPhotoIdentificationCreateDecisionAutoCreatable(classification.decision)
        ? await signPhotoIdentificationCreateToken({
            type: "photo_identification_create",
            userId: context.user.id,
            pendingImageId: pendingImage.id,
            decision: classification.decision,
            photoSuitability: imageEvidence.photoSuitability,
          })
        : null;

    return {
      pendingImage: serializedPendingImage,
      imageEvidence,
      classification:
        await serializePhotoIdentificationClassification(classification),
      suggestedNextStep,
      diagnostics,
      createToken,
    };
  } finally {
    requestSignal?.removeEventListener("abort", stopOnDisconnect);
    if (!settled) {
      stop.abort();
      logPhotoIdentificationCancelled({
        log: services.logOutcome,
        context,
        pendingImage,
        idempotencyKey,
        file,
      });
    }
  }
}

/**
 * Turns callbacks into an async iterable that ends once `close` is called and
 * every pushed item has been read.
 */
function createProgressQueue<T>() {
  const items: T[] = [];
  let closed = false;
  let wake: (() => void) | null = null;

  return {
    push: (item: T) => {
      items.push(item);
      wake?.();
    },
    close: () => {
      closed = true;
      wake?.();
    },
    async *[Symbol.asyncIterator]() {
      while (true) {
        const item = items.shift();
        if (item !== undefined) {
          yield item;
          continue;
        }
        if (closed) return;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
        wake = null;
      }
    },
  };
}

async function serializePhotoIdentificationProgress(
  event: PhotoIdentificationProgress,
): Promise<z.infer<typeof PhotoIdentificationProgressSchema>> {
  if (event.type !== "candidates") return event;
  return {
    type: "candidates",
    bottles: await serializeActiveCandidateBottles(event.candidates),
  };
}

const MAX_PROGRESS_CANDIDATES = 5;

/** Serializes Peated's likely matches in their given order, skipping removed Bottles. */
async function serializeActiveCandidateBottles(
  candidates: PhotoIdentificationCandidates,
) {
  const bottleIds = Array.from(
    new Set(candidates.map((candidate) => candidate.bottleId)),
  ).slice(0, MAX_PROGRESS_CANDIDATES);
  if (bottleIds.length === 0) return [];

  const [bottleRows, tombstones] = await Promise.all([
    db.query.bottles.findMany({
      where: (bottles, { inArray }) => inArray(bottles.id, bottleIds),
    }),
    db.query.bottleTombstones.findMany({
      columns: { bottleId: true },
      where: (tombstones, { inArray }) =>
        inArray(tombstones.bottleId, bottleIds),
    }),
  ]);
  const removed = new Set(tombstones.map((row) => row.bottleId));
  const byId = new Map(bottleRows.map((bottle) => [bottle.id, bottle]));
  const activeBottles = bottleIds.flatMap((id) => {
    const bottle = byId.get(id);
    return bottle && !removed.has(id) ? [bottle] : [];
  });

  return await serialize(BottleSerializer, activeBottles, undefined, [], {
    includeGroupSummary: true,
  });
}

export default createPhotoIdentificationProcedure();
