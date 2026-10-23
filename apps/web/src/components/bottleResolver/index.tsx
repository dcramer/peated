"use client";

import { isORPCClientError } from "@peated/orpc/client/errors";
import {
  FormNotice,
  FormStack,
} from "@peated/web/components/formLayout.stylex";
import { WorkflowScreen } from "@peated/web/components/workflowScreen.stylex";
import { shrinkPhotoForUpload } from "@peated/web/lib/blobs";
import { logError, logInfo } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  createORPCResponseTraceContext,
  isORPCAccountRedirectError,
  type ORPCResponseTraceContext,
} from "@peated/web/lib/orpc/link";
import { saveWrongPhotoMatchPick } from "@peated/web/lib/wrongPhotoMatches";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import {
  applyPhotoProgress,
  createIdempotencyKey,
  EMPTY_PHOTO_PROGRESS,
  getCreateBottlePrefill,
  getCreateDecision,
  getCreateNameSeed,
  getFallbackReason,
  getMatchedBottle,
  getProposedName,
  getSearchSeed,
  SLOW_PHOTO_IDENTIFICATION_MS,
  type PhotoIdentification,
  type PhotoIdentificationCreateInput,
  type PhotoIdentificationProgressEvent,
  type PhotoMatchCandidate,
  type PhotoProgress,
} from "./helpers";
import { BottleResolverColumn } from "./layout.stylex";
import {
  getPhotoFailureCopyPayload,
  getPhotoIdentificationCopyPayload,
  PhotoIdentificationTraceFootnote,
  type PhotoFailureTrace,
} from "./panels";
import {
  PhotoFallbackState,
  PhotoLoadingState,
  PhotoMatchState,
  PhotoUploadState,
} from "./states";
import type {
  BottleResolverAction,
  BottleResolverMatchedAction,
  BottleResolverProps,
  BottleResolverResult,
} from "./types";

export type {
  BottleResolverAction,
  BottleResolverCreateProposalActionsProps,
  BottleResolverMatchedAction,
  BottleResolverMatchedActionsProps,
  BottleResolverProps,
  BottleResolverResult,
  PendingImageRef,
} from "./types";

/** Shortest time a classifier step stays on screen, so quick tool calls don't flicker. */
const MINIMUM_STEP_MS = 1200;

/**
 * Holds each value for at least `minimumMs` before showing the next one. A
 * cleared value (null), such as a new photo starting, shows at once.
 */
function useSteadyValue<T>(value: T | null, minimumMs: number): T | null {
  const [shown, setShown] = useState(value);
  const shownAtRef = useRef(0);

  useEffect(() => {
    if (Object.is(value, shown)) return;
    const wait =
      value === null
        ? 0
        : Math.max(0, shownAtRef.current + minimumMs - Date.now());
    const timer = setTimeout(() => {
      shownAtRef.current = Date.now();
      setShown(value);
    }, wait);
    return () => clearTimeout(timer);
  }, [value, shown, minimumMs]);

  return shown;
}

export default function BottleResolver({
  onResolve,
  searchHrefForQuery,
  createBottleHrefForResult,
  title,
  search,
  renderMatchedResultActions,
  renderCreateProposalActions,
}: BottleResolverProps) {
  const orpc = useORPC();
  const photoRequestRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const transferredPreviewUrlRef = useRef<string | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoResult, setPhotoResult] = useState<PhotoIdentification | null>(
    null,
  );
  const [photoProgress, setPhotoProgress] = useState<PhotoProgress | null>(
    null,
  );
  const [photoSlow, setPhotoSlow] = useState(false);
  const [pickingBottleId, setPickingBottleId] = useState<number | null>(null);
  const [photoIdentificationTraceId, setPhotoIdentificationTraceId] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoFailureTrace, setPhotoFailureTrace] =
    useState<PhotoFailureTrace | null>(null);
  const [resolvingAction, setResolvingAction] =
    useState<BottleResolverAction | null>(null);
  const [matchedBottleStatus, setMatchedBottleStatus] = useState<{
    bottleId: number;
    hasLibraryEntry: boolean;
    imageUrl: string | null;
    loading: boolean;
  } | null>(null);
  // Set once the member says the matched Bottle is not theirs. `id` is null
  // when the report could not be saved; search still works without it.
  const [wrongMatch, setWrongMatch] = useState<{ id: number | null } | null>(
    null,
  );
  const [reportingWrongMatch, setReportingWrongMatch] = useState(false);

  const photoIdentificationMutation = useMutation({
    retry: false,
    mutationFn: async ({
      responseTraceContext,
      signal,
      onProgress,
      ...input
    }: {
      file: File;
      idempotencyKey: string;
      responseTraceContext: ORPCResponseTraceContext;
      signal: AbortSignal;
      onProgress: (event: PhotoIdentificationProgressEvent) => void;
    }) => {
      const stream = await orpc.tastings.photoIdentification.call(input, {
        context: { responseTraceContext },
        signal,
      });
      while (true) {
        const step = await stream.next();
        if (step.done) return step.value;
        onProgress(step.value);
      }
    },
  });
  const photoIdentificationCreateMutation = useMutation(
    orpc.tastings.photoIdentificationCreate.mutationOptions(),
  );
  const wrongPhotoMatchCreateMutation = useMutation(
    orpc.wrongPhotoMatches.create.mutationOptions(),
  );
  // True from choosing a photo until its lookup ends or the member stops it.
  // It covers shrinking the photo before the upload starts, so the resolver
  // never shows an empty screen.
  const [isIdentifying, setIsIdentifying] = useState(false);
  const steadyStep = useSteadyValue(
    photoProgress?.step ?? null,
    MINIMUM_STEP_MS,
  );

  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      photoRequestRef.current?.abort();
      photoRequestRef.current = null;
      const current = previewUrlRef.current;
      if (current && current !== transferredPreviewUrlRef.current) {
        URL.revokeObjectURL(current);
      }
    };
  }, []);

  function replacePreviewUrl(nextPreviewUrl: string | null) {
    const current = previewUrlRef.current;
    if (current && current !== transferredPreviewUrlRef.current) {
      URL.revokeObjectURL(current);
    }
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
  }

  async function resolveBottle(
    bottle: Omit<BottleResolverResult, "pendingImage" | "previewUrl">,
    action?: BottleResolverAction,
  ) {
    const currentPreviewUrl = previewUrl;
    const photoTrace =
      photoResult && photoIdentificationTraceId
        ? {
            traceId: photoIdentificationTraceId,
            copyPayload: getPhotoIdentificationCopyPayload(
              photoResult,
              photoIdentificationTraceId,
            ),
          }
        : undefined;
    await onResolve(
      {
        ...bottle,
        pendingImage:
          photoResult?.pendingImage ?? photoProgress?.pendingImage ?? null,
        previewUrl: currentPreviewUrl,
        photoTrace,
        wrongPhotoMatchId: wrongMatch?.id ?? null,
      },
      action,
    );
    transferredPreviewUrlRef.current = currentPreviewUrl;
  }

  async function loadBottle(
    bottle: BottleResolverResult["bottle"],
    action?: BottleResolverMatchedAction,
  ) {
    setError(null);
    setResolvingAction(action ?? "library");
    try {
      const collectionStatus = await orpc.collections.bottles.list.call({
        user: "me",
        collection: "library",
        bottle: bottle.id,
      });
      const libraryEntry = collectionStatus.results[0] ?? null;
      await resolveBottle(
        {
          bottle,
          hasLibraryEntry: Boolean(libraryEntry),
          libraryEntryImageUrl: libraryEntry?.imageUrl ?? null,
        },
        action,
      );
    } catch (err) {
      logError(err);
      setError("We couldn't load that bottle. Search for it to keep going.");
    } finally {
      setResolvingAction(null);
    }
  }

  async function acceptCreateProposal(
    result: PhotoIdentification,
    action: BottleResolverAction,
  ) {
    if (
      result.classification.status !== "classified" ||
      !getCreateDecision(result)
    ) {
      return;
    }

    setError(null);
    setResolvingAction(action);
    try {
      if (!result.createToken) {
        setError(
          "We couldn't add that bottle from the photo. Search for the bottle to keep going.",
        );
        return;
      }

      const payload: PhotoIdentificationCreateInput = {
        createToken: result.createToken,
      };
      const created =
        await photoIdentificationCreateMutation.mutateAsync(payload);
      await resolveBottle(
        {
          bottle: created.bottle,
          hasLibraryEntry: false,
          resultSource: "created",
          warnings: (created.warnings ?? []).map(
            (warning) =>
              warning.message ||
              "The bottle was added, but the public image was not saved.",
          ),
        },
        action,
      );
    } catch (err) {
      if (isORPCAccountRedirectError(err)) return;

      logError(err);
      setError(
        "We couldn't add that bottle from the photo. Search for the bottle to keep going.",
      );
    } finally {
      setResolvingAction(null);
    }
  }

  async function reportWrongMatch(result: PhotoIdentification) {
    setReportingWrongMatch(true);
    let id: number | null = null;
    try {
      if (result.wrongMatchToken) {
        const created = await wrongPhotoMatchCreateMutation.mutateAsync({
          token: result.wrongMatchToken,
          traceId: photoIdentificationTraceId,
        });
        id = created.id;
      }
    } catch (err) {
      if (isORPCAccountRedirectError(err)) return;
      // The member can still find their bottle; only the report is lost.
      logError(err);
    } finally {
      setReportingWrongMatch(false);
    }
    setWrongMatch({ id });
  }

  async function identifyPhoto(file: File) {
    photoRequestRef.current?.abort();
    const controller = new AbortController();
    photoRequestRef.current = controller;
    const startedAt = performance.now();
    let outcome = "failed";
    let timedOut = false;
    let errorCode: string | null = null;
    let suggestedNextStep: string | null = null;
    let uploadSize: number | null = null;
    // Stop waiting after 10 minutes, including the upload and bottle lookup.
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 600_000);
    const slowTimeout = setTimeout(() => {
      if (photoRequestRef.current === controller) setPhotoSlow(true);
    }, SLOW_PHOTO_IDENTIFICATION_MS);
    setError(null);
    setPhotoError(null);
    setPhotoResult(null);
    setPhotoProgress(EMPTY_PHOTO_PROGRESS);
    setPhotoSlow(false);
    setPhotoIdentificationTraceId(null);
    setPhotoFailureTrace(null);
    setWrongMatch(null);
    setIsIdentifying(true);

    const nextPreviewUrl = URL.createObjectURL(file);
    replacePreviewUrl(nextPreviewUrl);
    const idempotencyKey = createIdempotencyKey();
    const responseTraceContext = createORPCResponseTraceContext();

    logInfo("Bottle photo submission started", {
      extra: {
        "photo_identification.idempotency_key": idempotencyKey,
        "photo_identification.file_size": file.size,
        "photo_identification.file_type": file.type || "unknown",
      },
    });
    try {
      const upload = await shrinkPhotoForUpload(file, 1600);
      uploadSize = upload.size;
      const result = await photoIdentificationMutation.mutateAsync({
        file: upload,
        idempotencyKey,
        responseTraceContext,
        signal: controller.signal,
        onProgress: (event) => {
          if (photoRequestRef.current !== controller) return;
          setPhotoProgress((progress) =>
            applyPhotoProgress(progress ?? EMPTY_PHOTO_PROGRESS, event),
          );
        },
      });
      if (photoRequestRef.current !== controller) {
        outcome = "cancelled";
        return;
      }
      outcome = "completed";
      suggestedNextStep = result.suggestedNextStep;
      setPhotoResult(result);
      setPhotoIdentificationTraceId(responseTraceContext.sentryTraceId);
    } catch (err) {
      if (photoRequestRef.current !== controller) {
        outcome = "cancelled";
        return;
      }
      if (isORPCAccountRedirectError(err)) {
        outcome = "unauthorized";
        return;
      }

      // The RPC client already reports errors to Sentry.
      errorCode = isORPCClientError(err) ? err.code : "NETWORK_ERROR";
      outcome = timedOut ? "timeout" : "failed";
      setPhotoError(
        timedOut
          ? "This is taking too long. Search by name or try again later."
          : errorCode === "SERVICE_UNAVAILABLE"
            ? "We can't check photos right now. Search by name or try again later."
            : errorCode === "PAYLOAD_TOO_LARGE"
              ? "That photo is too large. Choose a smaller photo or search by name."
              : "Search by name, or try uploading your photo again.",
      );
      const sentryTraceId = responseTraceContext.sentryTraceId;
      if (sentryTraceId) {
        setPhotoFailureTrace({
          traceId: sentryTraceId,
          file: {
            name: file.name,
            size: file.size,
            type: file.type || null,
            lastModified: file.lastModified,
          },
          error:
            err instanceof Error
              ? err.message
              : "Unable to identify bottle from photo.",
        });
      }
    } finally {
      clearTimeout(timeout);
      clearTimeout(slowTimeout);
      if (photoRequestRef.current === controller) {
        photoRequestRef.current = null;
        setIsIdentifying(false);
      }
      logInfo("Bottle photo submission finished", {
        extra: {
          "photo_identification.idempotency_key": idempotencyKey,
          "photo_identification.outcome": outcome,
          "photo_identification.duration_ms": Math.round(
            performance.now() - startedAt,
          ),
          "photo_identification.error_code": errorCode,
          "photo_identification.suggested_next_step": suggestedNextStep,
          "photo_identification.server_trace_id":
            responseTraceContext.sentryTraceId,
          "photo_identification.file_size": file.size,
          "photo_identification.file_type": file.type || "unknown",
          "photo_identification.upload_size": uploadSize,
        },
      });
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    void identifyPhoto(file);
    event.target.value = "";
  }

  /**
   * Continues with a Bottle the member picked: a likely match while the lookup
   * runs, which stops it, or a suggestion, which is saved on any wrong-match
   * report.
   */
  async function pickBottle(bottle: PhotoMatchCandidate) {
    photoRequestRef.current?.abort();
    photoRequestRef.current = null;
    setIsIdentifying(false);
    if (wrongMatch?.id) {
      void saveWrongPhotoMatchPick(
        orpc.wrongPhotoMatches.update.call,
        wrongMatch.id,
        bottle.id,
      );
    }
    setPickingBottleId(bottle.id);
    try {
      await loadBottle(bottle);
    } finally {
      setPickingBottleId(null);
    }
  }

  function startOver() {
    photoRequestRef.current?.abort();
    photoRequestRef.current = null;
    setIsIdentifying(false);
    setError(null);
    setPhotoError(null);
    setPhotoResult(null);
    setPhotoProgress(null);
    setPhotoSlow(false);
    setPhotoIdentificationTraceId(null);
    setPhotoFailureTrace(null);
    setMatchedBottleStatus(null);
    setWrongMatch(null);
    replacePreviewUrl(null);
  }

  const matchedBottle = getMatchedBottle(photoResult);
  const createDecision = getCreateDecision(photoResult);
  const proposedName = getProposedName(photoResult);
  const defaultSearchHref = searchHrefForQuery();
  const searchSeed = getSearchSeed(photoResult);
  const wrongMatchId = wrongMatch?.id ?? null;
  const searchHref = searchHrefForQuery(
    searchSeed,
    photoResult?.pendingImage,
    wrongMatchId,
  );
  const createBottlePrefill = getCreateBottlePrefill(photoResult);
  const createBottleHref =
    photoResult && createBottleHrefForResult
      ? createBottleHrefForResult(
          getCreateNameSeed(photoResult),
          createBottlePrefill,
          photoResult.pendingImage,
          wrongMatchId,
        )
      : null;
  // The lookup's other candidates, streamed while it ran, minus the Bottle it
  // matched (or the member rejected).
  const suggestions = (photoProgress?.candidates ?? [])
    .filter((bottle) => bottle.id !== matchedBottle?.id)
    .slice(0, 3);
  const matchedBottleHasLibraryEntry =
    matchedBottleStatus && matchedBottleStatus.bottleId === matchedBottle?.id
      ? matchedBottleStatus.hasLibraryEntry
      : false;
  const matchedBottleLibraryStatusLoading =
    Boolean(matchedBottle) &&
    (matchedBottleStatus?.bottleId !== matchedBottle?.id ||
      matchedBottleStatus?.loading !== false);

  useEffect(() => {
    if (!matchedBottle) {
      setMatchedBottleStatus(null);
      return;
    }

    const statusBottleId = matchedBottle.id;
    let cancelled = false;
    setMatchedBottleStatus({
      bottleId: statusBottleId,
      hasLibraryEntry: false,
      imageUrl: null,
      loading: true,
    });

    async function loadMatchedBottleStatus() {
      try {
        const collectionStatus = await orpc.collections.bottles.list.call({
          user: "me",
          collection: "library",
          bottle: statusBottleId,
        });
        const libraryEntry = collectionStatus.results[0] ?? null;
        if (cancelled) return;
        setMatchedBottleStatus({
          bottleId: statusBottleId,
          hasLibraryEntry: Boolean(libraryEntry),
          imageUrl: libraryEntry?.imageUrl ?? null,
          loading: false,
        });
      } catch (err) {
        logError(err);
        if (cancelled) return;
        setMatchedBottleStatus({
          bottleId: statusBottleId,
          hasLibraryEntry: false,
          imageUrl: null,
          loading: false,
        });
      }
    }

    void loadMatchedBottleStatus();

    return () => {
      cancelled = true;
    };
  }, [matchedBottle, orpc]);

  return (
    <WorkflowScreen title={title}>
      <input
        accept="image/*"
        hidden
        onChange={onFileChange}
        ref={fileInputRef}
        type="file"
      />

      <FormStack>
        {!previewUrl && !photoResult && !isIdentifying && (
          <PhotoUploadState
            search={search}
            searchHref={defaultSearchHref}
            title={title}
            onSelectPhoto={() => fileInputRef.current?.click()}
          />
        )}

        {!isIdentifying && previewUrl && !photoResult && photoError && (
          <>
            <PhotoFallbackState
              alert
              createBottleHref={createBottleHrefForResult?.("") ?? null}
              onPickSuggestion={() => undefined}
              onStartOver={startOver}
              previewUrl={previewUrl}
              reason={photoError}
              result={null}
              searchHref={defaultSearchHref}
              suggestions={[]}
            />
            {photoFailureTrace && (
              <PhotoIdentificationTraceFootnote
                traceId={photoFailureTrace.traceId}
                copyPayload={getPhotoFailureCopyPayload(photoFailureTrace)}
              />
            )}
          </>
        )}

        {(isIdentifying || (photoProgress && !photoResult && !photoError)) && (
          <PhotoLoadingState
            previewUrl={previewUrl}
            progress={{
              ...(photoProgress ?? EMPTY_PHOTO_PROGRESS),
              step: steadyStep,
            }}
            identifying={isIdentifying}
            slow={photoSlow}
            pickingBottleId={pickingBottleId}
            search={search}
            searchHref={defaultSearchHref}
            onPickMatch={(bottle) => {
              void pickBottle(bottle);
            }}
            onStartOver={startOver}
          />
        )}

        {!isIdentifying && photoResult && (
          <BottleResolverColumn>
            {matchedBottle && !wrongMatch ? (
              <PhotoMatchState
                result={photoResult}
                previewUrl={previewUrl}
                matchedBottle={matchedBottle}
                renderMatchedResultActions={renderMatchedResultActions}
                resolvingAction={resolvingAction}
                hasLibraryEntry={matchedBottleHasLibraryEntry}
                libraryEntryImageUrl={matchedBottleStatus?.imageUrl}
                pendingImage={photoResult.pendingImage}
                loadingExactLibraryStatus={matchedBottleLibraryStatusLoading}
                onLoadBottle={(bottle, action) => {
                  void loadBottle(bottle, action);
                }}
                reportingWrongMatch={reportingWrongMatch}
                onWrongMatch={() => {
                  void reportWrongMatch(photoResult);
                }}
              />
            ) : (
              <PhotoFallbackState
                result={photoResult}
                previewUrl={previewUrl}
                reason={
                  wrongMatch
                    ? wrongMatch.id
                      ? "Thanks, we've noted the wrong match."
                      : "Let's find the right one."
                    : getFallbackReason(photoResult)
                }
                suggestions={suggestions}
                pickingBottleId={pickingBottleId}
                onPickSuggestion={(bottle) => {
                  void pickBottle(bottle);
                }}
                proposal={
                  createDecision && proposedName
                    ? {
                        name: proposedName,
                        actions: renderCreateProposalActions({
                          createPending:
                            photoIdentificationCreateMutation.isPending,
                          resolvingAction,
                          onResolve: (action) =>
                            void acceptCreateProposal(photoResult, action),
                        }),
                      }
                    : null
                }
                createBottleHref={createBottleHref}
                searchHref={searchHref}
                onStartOver={startOver}
              />
            )}
            {photoIdentificationTraceId && (
              <PhotoIdentificationTraceFootnote
                traceId={photoIdentificationTraceId}
                copyPayload={getPhotoIdentificationCopyPayload(
                  photoResult,
                  photoIdentificationTraceId,
                )}
              />
            )}
          </BottleResolverColumn>
        )}

        {error ? <FormNotice role="alert">{error}</FormNotice> : null}
      </FormStack>
    </WorkflowScreen>
  );
}
