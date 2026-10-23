import { createWhiskyLabelExtractor } from "@peated/bottle-classifier";
import {
  agentActionRiskClass,
  deriveAutomationTier,
} from "@peated/bottle-classifier/automationTier";
import {
  createDecidedBottleClassification,
  createIgnoredBottleClassification,
} from "@peated/bottle-classifier/contract";
import type { BottleClassifierProgressEvent } from "@peated/bottle-classifier/internal/runtime";
import type { BottleCandidate } from "@peated/bottle-classifier/internal/types";
import {
  BottleExtractedDetailsSchema,
  ImageBottleEvidenceSchema,
  runBottleReference,
  type BottleExtractedDetails,
  type ImageBottleEvidence,
} from "@peated/server/agents/bottleClassifier";
import { findExactReferenceBottleCandidate } from "@peated/server/agents/bottleClassifier/findExactReferenceBottleCandidate";
import config from "@peated/server/config";
import {
  createOpenAIClient,
  withSentryConversation,
} from "@peated/server/lib/openaiClient";
import { instrumentOpenAIResponsesCall } from "@peated/server/lib/openaiResponsesTelemetry";
import { getUploadImageDataUrl } from "@peated/server/lib/uploads";
import { absoluteUrl } from "@peated/server/lib/urls";
import {
  type PhotoIdentificationDiagnosticsSchema,
  type PhotoIdentificationProposedBottleSchema,
  type PhotoIdentificationSchema,
  type PhotoIdentificationStepEnum,
  type PhotoIdentificationSuggestedNextStepEnum,
} from "@peated/server/schemas";
import * as Sentry from "@sentry/node";
import { z } from "zod";

/**
 * Per-member limit for identifying Bottle photos. The photo route and
 * background tasting draft identification share it, so drafts cannot be used
 * to get around the route's limit.
 */
export const PHOTO_IDENTIFICATION_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000,
  maxRequests: 30,
  keyPrefix: "photo-identification",
};

/**
 * Longest a photo's bottle lookup may run after the label is read. It bounds
 * the model cost of one photo; past it, the member gets the label facts
 * instead of a match.
 */
export const PHOTO_LOOKUP_TIME_LIMIT_MS = 3 * 60 * 1000;

/** A stored Bottle photo: a pending upload or a tasting draft's photo. */
type PhotoIdentificationImage = {
  id: string;
  imageUrl: string;
};

function maybeField<T extends boolean | number | string | string[]>(
  value: T | null | undefined,
  confidence = 0.75,
) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return undefined;
  }

  return {
    value,
    confidence,
    sourceExtractorIndexes: [0],
  };
}

/**
 * Converts reviewed label extraction output into the image-evidence contract
 * consumed by the bottle classifier and returned by photo identification.
 */
export function buildPhotoEvidenceFromExtractedIdentity({
  photo,
  extractedIdentity,
  rawLabelText = null,
}: {
  photo: PhotoIdentificationImage;
  extractedIdentity: BottleExtractedDetails | null;
  rawLabelText?: string | null;
}): ImageBottleEvidence {
  const labelParts = [
    extractedIdentity?.brand,
    extractedIdentity?.expression,
    extractedIdentity?.series,
    ...(extractedIdentity?.distillery ?? []),
    extractedIdentity?.bottler,
    extractedIdentity?.edition,
    extractedIdentity?.stated_age
      ? `${extractedIdentity.stated_age} year old`
      : null,
    extractedIdentity?.abv ? `${extractedIdentity.abv}% ABV` : null,
    extractedIdentity?.vintage_year
      ? `${extractedIdentity.vintage_year} vintage`
      : null,
    extractedIdentity?.bottling_year
      ? `bottled ${extractedIdentity.bottling_year}`
      : null,
    extractedIdentity?.release_year
      ? `${extractedIdentity.release_year} release`
      : null,
  ].filter(Boolean);

  return ImageBottleEvidenceSchema.parse({
    sourceImageId: photo.id,
    extractors: [
      {
        kind: "vision",
        model: config.OPENAI_IMAGE_EXTRACTION_MODEL,
        confidence: extractedIdentity ? 0.75 : 0,
        textSpans:
          rawLabelText || labelParts.length
            ? [
                {
                  text: rawLabelText ?? labelParts.join(" "),
                  confidence: 0.75,
                },
              ]
            : [],
        observations: extractedIdentity
          ? ["Read whisky label identity from the uploaded bottle photo."]
          : ["No reliable bottle identity was read from the uploaded photo."],
      },
    ],
    fieldCandidates: {
      brand: maybeField(extractedIdentity?.brand),
      expression: maybeField(extractedIdentity?.expression),
      series: maybeField(extractedIdentity?.series),
      distillery: maybeField(extractedIdentity?.distillery),
      bottler: maybeField(extractedIdentity?.bottler),
      category: maybeField(extractedIdentity?.category),
      statedAge: maybeField(extractedIdentity?.stated_age),
      abv: maybeField(extractedIdentity?.abv),
      vintageYear: maybeField(extractedIdentity?.vintage_year),
      bottlingYear: maybeField(extractedIdentity?.bottling_year),
      releaseYear: maybeField(extractedIdentity?.release_year),
      edition: maybeField(extractedIdentity?.edition),
      caskNumber: maybeField(extractedIdentity?.cask_number),
      maturation: maybeField(extractedIdentity?.maturation),
      outturn: maybeField(extractedIdentity?.outturn),
      caskStrength: maybeField(extractedIdentity?.cask_strength),
      singleCask: maybeField(extractedIdentity?.single_cask),
    },
    photoSuitability: {
      isSingleBottlePhoto: Boolean(extractedIdentity),
      labelReadable: Boolean(extractedIdentity),
      suitableAsTastingImage: true,
      suitableAsBottleImage: Boolean(extractedIdentity),
      reason: extractedIdentity
        ? null
        : "No reliable label identity was extracted from the photo.",
    },
    conflicts: [],
  });
}

/**
 * Runs the server-owned whisky label extraction boundary for a pending image.
 */
async function extractPhotoBottleEvidence({
  photo,
  signal,
}: {
  photo: PhotoIdentificationImage;
  signal?: AbortSignal;
}): Promise<{
  extractedIdentity: BottleExtractedDetails | null;
  imageEvidence: ImageBottleEvidence;
}> {
  if (!config.AI_GATEWAY_API_KEY) {
    return {
      extractedIdentity: null,
      imageEvidence: buildPhotoEvidenceFromExtractedIdentity({
        photo,
        extractedIdentity: null,
      }),
    };
  }

  const conversationId = `photo_identification:${photo.id}`;
  const extraction = await withSentryConversation(conversationId, async () => {
    return await instrumentOpenAIResponsesCall({
      baseURL: config.AI_GATEWAY_HOST,
      conversationId,
      model: config.OPENAI_IMAGE_EXTRACTION_MODEL,
      callback: async (reportResponse) => {
        const extractor = createWhiskyLabelExtractor({
          // Limit the photo form’s wait; let the user choose when to retry.
          client: createOpenAIClient({
            instrumentWithSentry: false,
          }).withOptions({
            timeout: 45_000,
            maxRetries: 0,
          }),
          model: config.OPENAI_MODEL,
          reasoningEffort: config.OPENAI_REASONING_EFFORT,
          imageModel: config.OPENAI_IMAGE_EXTRACTION_MODEL,
          imageReasoningEffort: config.OPENAI_IMAGE_EXTRACTION_REASONING_EFFORT,
          onImageExtractionMetadata: reportResponse,
        });
        const extraction = await extractor.extractFromImageWithMetadata(
          await getUploadImageDataUrl(photo.imageUrl),
          { signal },
        );
        return {
          extractedIdentity: BottleExtractedDetailsSchema.nullable().parse(
            extraction.result,
          ),
          rawLabelText: extraction.rawLabelText,
        };
      },
    });
  });

  return {
    extractedIdentity: extraction.extractedIdentity,
    imageEvidence: buildPhotoEvidenceFromExtractedIdentity({
      photo,
      extractedIdentity: extraction.extractedIdentity,
      rawLabelText: extraction.rawLabelText,
    }),
  };
}

function buildPhotoReferenceName(
  extractedIdentity: BottleExtractedDetails | null,
) {
  const parts = [
    extractedIdentity?.brand,
    extractedIdentity?.expression,
    extractedIdentity?.series,
    extractedIdentity?.edition,
    extractedIdentity?.stated_age
      ? `${extractedIdentity.stated_age} year old`
      : null,
    extractedIdentity?.vintage_year
      ? `${extractedIdentity.vintage_year}`
      : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" ") : "Bottle photo upload";
}

export type PhotoIdentificationClassification = Awaited<
  ReturnType<typeof runBottleReference>
>["result"];
export type PhotoIdentificationModelMetadata = Awaited<
  ReturnType<typeof runBottleReference>
>["modelMetadata"];
type PhotoIdentificationAttributeValue =
  | boolean
  | number
  | string
  | string[]
  | number[];
export interface PhotoIdentificationAttributes {
  [name: string]: PhotoIdentificationAttributeValue;
}
export type PhotoIdentificationSpan = {
  setAttribute: (key: string, value: PhotoIdentificationAttributeValue) => void;
};

export type PhotoIdentificationStartSpan = <Result>(
  context: Parameters<typeof Sentry.startSpan>[0],
  callback: (span: PhotoIdentificationSpan) => Promise<Result>,
) => Promise<Result>;

type PhotoIdentificationStep = z.infer<typeof PhotoIdentificationStepEnum>;

/**
 * Progress from one photo identification, sent while it runs. Candidates are
 * Peated's own likely matches, found before the classifier model starts.
 */
export type PhotoIdentificationProgress =
  | { type: "label"; imageEvidence: ImageBottleEvidence }
  | { type: "candidates"; candidates: BottleCandidate[] }
  | { type: "step"; step: PhotoIdentificationStep };

const PEATED_LOOKUP_TOOLS = new Set([
  "search_bottles",
  "search_entities",
  "get_bottle_context",
  "get_entity_context",
]);

// Members see generic steps only. Web queries and site names stay on the
// server (product decision, photo-assisted-bottle-resolution.md).
function toPhotoIdentificationProgress(
  event: BottleClassifierProgressEvent,
): PhotoIdentificationProgress {
  if (event.type === "candidates") return event;
  if (event.status === "finished") return { type: "step", step: "comparing" };
  if (PEATED_LOOKUP_TOOLS.has(event.name)) {
    return { type: "step", step: "checking_peated" };
  }
  if (event.name.startsWith("firecrawl_")) {
    return { type: "step", step: "checking_web" };
  }
  return { type: "step", step: "comparing" };
}

export type IdentifyBottlePhotoServices = {
  extractEvidence: typeof extractPhotoBottleEvidence;
  runReference: typeof runBottleReference;
  startSpan: PhotoIdentificationStartSpan;
  lookupTimeLimitMs: number;
};

const identifyBottlePhotoServices: IdentifyBottlePhotoServices = {
  extractEvidence: extractPhotoBottleEvidence,
  runReference: runBottleReference,
  startSpan: (context, callback) => Sentry.startSpan(context, callback),
  lookupTimeLimitMs: PHOTO_LOOKUP_TIME_LIMIT_MS,
};

export type PhotoIdentificationDecision = Extract<
  PhotoIdentificationClassification,
  { status: "classified" }
>["decision"];

// Derives the automation tier for a photo-identification decision. Photo
// identification always carries the uploaded bottle photo as primary image
// evidence and never resolves against a current bottle assignment. The user
// still confirms the suggested next step, so this tier only chooses between the
// confirm and manual-search suggestions rather than acting silently.
function derivePhotoIdentificationTier(decision: PhotoIdentificationDecision) {
  const confidenceBasis = decision.confidenceBasis;

  return deriveAutomationTier({
    actionRiskClass: agentActionRiskClass(decision.action),
    hasUnresolvedRisks: (confidenceBasis?.unresolvedRisks.length ?? 0) > 0,
    webEvidence: confidenceBasis?.webEvidence ?? null,
    hasMatchTarget:
      decision.action === "match" && decision.matchedBottleId !== null,
    reaffirmsCurrentAssignment: false,
    replacesCurrentAssignment: false,
    hasDeterministicAnchor: decision.identityScope === "exact_cask",
    hasPrimaryLabelOrImageEvidence: true,
  });
}

export function isPhotoIdentificationCreateDecisionAutoCreatable(
  decision: PhotoIdentificationDecision,
) {
  return derivePhotoIdentificationTier(decision) === "auto";
}

function getSuggestedNextStep(
  classification: PhotoIdentificationClassification,
): z.infer<typeof PhotoIdentificationSuggestedNextStepEnum> {
  if (classification.status === "ignored") {
    return "manual_search";
  }

  switch (classification.decision.action) {
    case "match":
      return derivePhotoIdentificationTier(classification.decision) === "auto"
        ? "confirm_match"
        : "manual_search";
    case "create_bottle":
      return isPhotoIdentificationCreateDecisionAutoCreatable(
        classification.decision,
      )
        ? "confirm_create"
        : "manual_search";
    case "no_match":
      return "manual_search";
  }
}

function summarizeExtraction(
  imageEvidence: z.infer<typeof PhotoIdentificationSchema>["imageEvidence"],
) {
  const text = imageEvidence.extractors
    .flatMap((extractor) => extractor.textSpans.map((span) => span.text))
    .filter(Boolean)
    .join(" ")
    .trim();

  return text || null;
}

function buildPhotoIdentificationDiagnostics({
  extractionStatus,
  extractionSummary,
  classification,
}: {
  extractionStatus: z.infer<
    typeof PhotoIdentificationDiagnosticsSchema
  >["extraction"]["status"];
  extractionSummary: string | null;
  classification: PhotoIdentificationClassification;
}): z.infer<typeof PhotoIdentificationDiagnosticsSchema> {
  const artifacts = classification.artifacts;

  if (classification.status === "ignored") {
    return {
      extraction: {
        status: extractionStatus,
        summary: extractionSummary,
      },
      candidates: {
        count: artifacts.candidates.length,
      },
      classification: {
        status: "ignored",
        action: null,
        confidence: null,
        reason: classification.reason,
      },
    };
  }

  return {
    extraction: {
      status: extractionStatus,
      summary: extractionSummary,
    },
    candidates: {
      count: artifacts.candidates.length,
    },
    classification: {
      status: "classified",
      action: classification.decision.action,
      confidence: null,
      reason: classification.decision.rationale,
    },
  };
}

export function getClassificationLogAttributes(
  prefix: string,
  classification: PhotoIdentificationClassification,
  modelMetadata?: PhotoIdentificationModelMetadata,
) {
  const candidates = classification.artifacts.candidates;
  const candidateBottleIds = classification.artifacts.candidates
    .map((candidate) => candidate.bottleId)
    .flatMap((id) => {
      const parsed = z.number().safeParse(id);
      return parsed.success ? [parsed.data] : [];
    });
  const candidateNames = classification.artifacts.candidates
    .map((candidate) => candidate.fullName)
    .filter(Boolean)
    .slice(0, 5);
  // Sentry span attributes support scalar arrays, not object arrays, so keep a
  // bounded route-owned JSON-string projection for candidate trait debugging.
  const candidateIdentity = candidates.slice(0, 5).map((candidate) =>
    JSON.stringify({
      bottleId: candidate.bottleId,
      fullName: candidate.fullName,
      category: candidate.category,
      statedAge: candidate.statedAge,
      abv: candidate.abv,
      vintageYear: candidate.vintageYear,
      bottlingYear: candidate.bottlingYear,
      releaseYear: candidate.releaseYear,
      edition: candidate.edition,
    }),
  );
  const attrs: PhotoIdentificationAttributes = {
    [`${prefix}.status`]: classification.status,
    [`${prefix}.candidate_count`]: candidates.length,
    [`${prefix}.candidate_bottle_ids`]: candidateBottleIds,
    [`${prefix}.candidate_names`]: candidateNames,
    [`${prefix}.candidate_identity`]: candidateIdentity,
  };

  if (classification.status === "ignored") {
    attrs[`${prefix}.reason`] = classification.reason;
    return attrs;
  }

  const { decision } = classification;
  attrs[`${prefix}.action`] = decision.action;
  if (decision.confidenceBasis) {
    attrs[`${prefix}.confidence_basis_web_evidence`] =
      decision.confidenceBasis.webEvidence;
    attrs[`${prefix}.confidence_basis_unresolved_risk_count`] =
      decision.confidenceBasis.unresolvedRisks.length;
  }
  if (modelMetadata) {
    attrs[`${prefix}.tool_calls`] = modelMetadata.toolCalls.names;
  }
  if (decision.rationale) attrs[`${prefix}.reason`] = decision.rationale;

  if ("matchedBottleId" in decision && decision.matchedBottleId !== null) {
    attrs[`${prefix}.matched_bottle_id`] = decision.matchedBottleId;
  }
  if ("proposedBottle" in decision && decision.proposedBottle) {
    attrs[`${prefix}.proposed_bottle_brand`] =
      decision.proposedBottle.brand.name;
    attrs[`${prefix}.proposed_bottle_name`] = decision.proposedBottle.name;
  }
  return attrs;
}

export function getImageEvidenceFieldAttributes(
  imageEvidence: z.infer<typeof PhotoIdentificationSchema>["imageEvidence"],
) {
  const attrs: Record<string, string | number> = {};
  const fieldCandidates = imageEvidence.fieldCandidates;

  for (const field of [
    "brand",
    "expression",
    "statedAge",
    "abv",
    "vintageYear",
    "bottlingYear",
    "releaseYear",
    "edition",
  ] as const) {
    const candidate = fieldCandidates[field];
    if (!candidate) continue;
    attrs[`photo_identification.field.${field}`] = candidate.value;
    attrs[`photo_identification.field.${field}.confidence`] =
      candidate.confidence;
  }

  return attrs;
}

function setSpanAttributes(
  span: PhotoIdentificationSpan,
  attrs: PhotoIdentificationAttributes,
) {
  for (const [key, value] of Object.entries(attrs)) {
    span.setAttribute(key, value);
  }
}

/**
 * Runs the bottle lookup until it finishes, `signal` aborts, or the time limit
 * passes.
 */
async function runReferenceWithinTimeLimit({
  input,
  services,
  signal,
  span,
  onProgress,
}: {
  input: Parameters<typeof runBottleReference>[0];
  services: IdentifyBottlePhotoServices;
  signal?: AbortSignal;
  span: PhotoIdentificationSpan;
  onProgress?: (event: BottleClassifierProgressEvent) => void;
}): ReturnType<typeof runBottleReference> {
  const timeLimit = AbortSignal.timeout(services.lookupTimeLimitMs);
  try {
    return await services.runReference(input, {
      signal: signal ? AbortSignal.any([signal, timeLimit]) : timeLimit,
      onProgress,
    });
  } catch (err) {
    // Photo lookup cost rule: a lookup past its time limit stops and returns
    // the label facts already read. Other failures still fail.
    if (!timeLimit.aborted) throw err;
    span.setAttribute("photo_identification.lookup_timed_out", true);
    return {
      result: createIgnoredBottleClassification({
        reason: "The bottle lookup ran out of time.",
        artifacts: {
          extractedIdentity: input.extractedIdentity,
          imageEvidence: input.imageEvidence,
        },
      }),
      modelMetadata: null,
    };
  }
}

/**
 * Runs label extraction and local candidate discovery for a stored Bottle
 * photo. A literal accepted reference resolves directly; all other inputs run
 * the full classifier once, within `lookupTimeLimitMs`. A lookup that runs out
 * of time returns the label facts with no match. `signal` stops the lookup
 * when the caller no longer wants it, such as a closed request. Callers own the
 * photo's ownership checks and pass the attribute that names it, such as its
 * pending upload or tasting draft.
 *
 * This is the shared Photo Identification workflow span boundary for all callers.
 */
export async function identifyBottlePhoto(
  {
    photo,
    traceAttributes,
    signal,
    onProgress,
  }: {
    photo: PhotoIdentificationImage;
    traceAttributes: PhotoIdentificationAttributes;
    signal?: AbortSignal;
    onProgress?: (progress: PhotoIdentificationProgress) => void;
  },
  services: IdentifyBottlePhotoServices = identifyBottlePhotoServices,
) {
  const conversationId = `photo_identification:${photo.id}`;

  return await services.startSpan(
    {
      op: "gen_ai.invoke_workflow",
      name: "invoke_workflow Photo Identification",
      attributes: {
        "gen_ai.operation.name": "invoke_workflow",
        "gen_ai.provider.name": "openai",
        "gen_ai.workflow.name": "Photo Identification",
        "gen_ai.conversation.id": conversationId,
        ...traceAttributes,
        "photo_identification.source_image_url": absoluteUrl(
          config.API_SERVER,
          photo.imageUrl,
        ),
        "photo_identification.upload_path": photo.imageUrl,
      },
    },
    async (span) => {
      span.setAttribute("photo_identification.stage", "extraction");
      const { extractedIdentity, imageEvidence } =
        await services.extractEvidence({
          photo,
          signal,
        });
      onProgress?.({ type: "label", imageEvidence });

      const classificationInput = {
        reference: {
          id: photo.id,
          name: buildPhotoReferenceName(extractedIdentity),
          url: null,
          imageUrl: absoluteUrl(config.API_SERVER, photo.imageUrl),
        },
        conversationId,
        extractedIdentity,
        imageEvidence,
      };
      span.setAttribute("photo_identification.stage", "classification");
      const exactReferenceCandidate = await findExactReferenceBottleCandidate(
        classificationInput.reference.name,
      );
      const classificationRun = exactReferenceCandidate
        ? {
            result: createDecidedBottleClassification({
              decision: {
                action: "match",
                rationale:
                  "A literal stored Bottle reference identifies this Bottle.",
                candidateBottleIds: [exactReferenceCandidate.bottleId],
                identityScope: "product",
                observation: null,
                confidenceBasis: {
                  unresolvedRisks: [],
                  webEvidence: "not_needed",
                },
                matchedBottleId: exactReferenceCandidate.bottleId,
                proposedBottle: null,
              },
              artifacts: {
                extractedIdentity,
                imageEvidence,
                candidates: [exactReferenceCandidate],
              },
            }),
            modelMetadata: null,
          }
        : await runReferenceWithinTimeLimit({
            input: classificationInput,
            services,
            signal,
            span,
            onProgress: onProgress
              ? (event) => onProgress(toPhotoIdentificationProgress(event))
              : undefined,
          });
      const classification = classificationRun.result;
      const referenceName = classificationInput.reference.name;
      const diagnostics = buildPhotoIdentificationDiagnostics({
        extractionStatus: extractedIdentity ? "found" : "empty",
        extractionSummary: summarizeExtraction(imageEvidence),
        classification,
      });
      const suggestedNextStep = getSuggestedNextStep(classification);

      setSpanAttributes(span, {
        "photo_identification.stage": "completed",
        "photo_identification.reference_name": referenceName,
        "photo_identification.extracted_identity_summary": referenceName,
        "photo_identification.image_evidence_summary":
          diagnostics.extraction.summary ?? "none",
        "photo_identification.initial_candidate_count":
          exactReferenceCandidate === null ? 0 : 1,
        "photo_identification.final_candidate_count":
          classification.artifacts.candidates.length,
        "photo_identification.suggested_next_step": suggestedNextStep,
        ...getImageEvidenceFieldAttributes(imageEvidence),
        ...getClassificationLogAttributes(
          "photo_identification.final",
          classification,
          classificationRun.modelMetadata,
        ),
      });

      return {
        imageEvidence,
        classification,
        modelMetadata: classificationRun.modelMetadata,
        referenceName,
        diagnostics,
        suggestedNextStep,
      };
    },
  );
}

/**
 * The parts of a proposed Bottle a member sees before confirming it. Candidate
 * IDs, rationale, and other classifier internals stay on the server.
 */
export function serializeProposedBottle(
  proposedBottle: Extract<
    PhotoIdentificationDecision,
    { action: "create_bottle" }
  >["proposedBottle"],
): z.infer<typeof PhotoIdentificationProposedBottleSchema> {
  return {
    name: proposedBottle.name,
    series: proposedBottle.series
      ? {
          id: proposedBottle.series.id,
          name: proposedBottle.series.name,
        }
      : null,
    category: proposedBottle.category,
    edition: proposedBottle.edition,
    statedAge: proposedBottle.statedAge,
    abv: proposedBottle.abv,
    caskStrength: proposedBottle.caskStrength,
    singleCask: proposedBottle.singleCask,
    maturation: proposedBottle.maturation,
    caskNumber: proposedBottle.caskNumber,
    outturn: proposedBottle.outturn,
    vintageYear: proposedBottle.vintageYear,
    bottlingYear: proposedBottle.bottlingYear ?? null,
    releaseYear: proposedBottle.releaseYear,
    brand: {
      id: proposedBottle.brand.id,
      name: proposedBottle.brand.name,
    },
    distillers: proposedBottle.distillers.map((distiller) => ({
      id: distiller.id,
      name: distiller.name,
    })),
    bottler: proposedBottle.bottler
      ? {
          id: proposedBottle.bottler.id,
          name: proposedBottle.bottler.name,
        }
      : null,
  };
}
