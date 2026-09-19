"use client";

import { isORPCClientError } from "@peated/orpc/client/errors";
import { Button } from "@peated/web/components/button.stylex";
import {
  FormDetails,
  FormNotice,
  FormStack,
} from "@peated/web/components/formLayout.stylex";
import { WorkflowScreen } from "@peated/web/components/workflowScreen.stylex";
import { logError, logInfo } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  createORPCResponseTraceContext,
  isORPCUnauthorizedRedirectError,
  type ORPCResponseTraceContext,
} from "@peated/web/lib/orpc/link";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import {
  createIdempotencyKey,
  getCreateBottlePrefill,
  getCreateDecision,
  getCreateNameSeed,
  getCreateProposalLabel,
  getManualResultCopy,
  getMatchedBottle,
  getProposedName,
  getSearchSeed,
  type PhotoIdentification,
  type PhotoIdentificationCreateInput,
} from "./helpers";
import { BottleResolverColumn } from "./layout.stylex";
import {
  FallbackActions,
  getPhotoIdentificationCopyPayload,
  PhotoIdentificationTraceFootnote,
  type PhotoFailureTrace,
} from "./panels";
import {
  PhotoLoadingState,
  PhotoMatchCreateState,
  PhotoNoMatchState,
  PhotoReadFailureState,
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

export default function BottleResolver({
  onResolve,
  searchHrefForQuery,
  createBottleHrefForResult,
  title,
  search,
  renderMatchedResultActions,
  renderCreateProposalActions,
  createProposalActionLabel = "Continue",
  searchActionLabel = "Search bottles",
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

  const photoIdentificationMutation = useMutation({
    retry: false,
    mutationFn: async ({
      responseTraceContext,
      signal,
      ...input
    }: {
      file: File;
      idempotencyKey: string;
      responseTraceContext: ORPCResponseTraceContext;
      signal: AbortSignal;
    }) => {
      return orpc.tastings.photoIdentification.call(input, {
        context: { responseTraceContext },
        signal,
      });
    },
  });
  const photoIdentificationCreateMutation = useMutation(
    orpc.tastings.photoIdentificationCreate.mutationOptions(),
  );
  const isIdentifying = photoIdentificationMutation.isPending;

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
        pendingImage: photoResult?.pendingImage ?? null,
        previewUrl: currentPreviewUrl,
        photoTrace,
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
      if (isORPCUnauthorizedRedirectError(err)) return;

      logError(err);
      setError(
        "We couldn't add that bottle from the photo. Search for the bottle to keep going.",
      );
    } finally {
      setResolvingAction(null);
    }
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
    // Stop waiting after two minutes, including the upload and bottle lookup.
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 120_000);
    setError(null);
    setPhotoError(null);
    setPhotoResult(null);
    setPhotoIdentificationTraceId(null);
    setPhotoFailureTrace(null);

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
      const result = await photoIdentificationMutation.mutateAsync({
        file,
        idempotencyKey,
        responseTraceContext,
        signal: controller.signal,
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
      if (isORPCUnauthorizedRedirectError(err)) {
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
      if (photoRequestRef.current === controller)
        photoRequestRef.current = null;
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

  function startOver() {
    photoRequestRef.current?.abort();
    photoRequestRef.current = null;
    photoIdentificationMutation.reset();
    setError(null);
    setPhotoError(null);
    setPhotoResult(null);
    setPhotoIdentificationTraceId(null);
    setPhotoFailureTrace(null);
    setMatchedBottleStatus(null);
    replacePreviewUrl(null);
  }

  const matchedBottle = getMatchedBottle(photoResult);
  const createDecision = getCreateDecision(photoResult);
  const proposedName = getProposedName(photoResult);
  const createProposalLabel = getCreateProposalLabel(photoResult);
  const defaultSearchHref = searchHrefForQuery();
  const searchSeed = getSearchSeed(photoResult);
  const searchHref = searchHrefForQuery(searchSeed, photoResult?.pendingImage);
  const createBottlePrefill = getCreateBottlePrefill(photoResult);
  const createBottleHref =
    photoResult && createBottleHrefForResult
      ? createBottleHrefForResult(
          getCreateNameSeed(photoResult),
          createBottlePrefill,
          photoResult.pendingImage,
        )
      : null;
  const manualResultCopy = getManualResultCopy(photoResult);
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
          <PhotoReadFailureState
            previewUrl={previewUrl}
            photoError={photoError}
            searchHref={defaultSearchHref}
            searchLabel={searchActionLabel}
            createBottleHref={createBottleHrefForResult?.("") ?? null}
            trace={photoFailureTrace}
            onStartOver={startOver}
          />
        )}

        {isIdentifying && (
          <PhotoLoadingState
            previewUrl={previewUrl}
            search={search}
            searchHref={defaultSearchHref}
            onStartOver={startOver}
          />
        )}

        {!isIdentifying && photoResult && (
          <BottleResolverColumn>
            {matchedBottle || createDecision ? (
              <PhotoMatchCreateState
                result={photoResult}
                previewUrl={previewUrl}
                matchedBottle={matchedBottle}
                renderMatchedResultActions={renderMatchedResultActions}
                renderCreateProposalActions={renderCreateProposalActions}
                createProposalLabel={createProposalLabel}
                hasCreateDecision={Boolean(createDecision)}
                proposedName={proposedName}
                createPending={photoIdentificationCreateMutation.isPending}
                createActionLabel={createProposalActionLabel}
                resolvingAction={resolvingAction}
                hasLibraryEntry={matchedBottleHasLibraryEntry}
                libraryEntryImageUrl={matchedBottleStatus?.imageUrl}
                pendingImage={photoResult.pendingImage}
                loadingExactLibraryStatus={matchedBottleLibraryStatusLoading}
                onLoadBottle={(bottle, action) => {
                  void loadBottle(bottle, action);
                }}
                onAcceptCreateProposal={(result, action) => {
                  void acceptCreateProposal(result, action);
                }}
                onStartOver={startOver}
              />
            ) : (
              <PhotoNoMatchState
                result={photoResult}
                previewUrl={previewUrl}
                title={manualResultCopy.title}
                description={manualResultCopy.description}
                searchHref={searchHref}
                searchLabel={searchActionLabel}
                createBottleHref={
                  manualResultCopy.createLabel ? createBottleHref : null
                }
                createBottleLabel={manualResultCopy.createLabel}
                primaryAction={manualResultCopy.primaryAction}
                onStartOver={startOver}
              />
            )}
            {matchedBottle ? (
              <FormDetails compact title="Change bottle">
                <FallbackActions
                  searchHref={searchHref}
                  searchLabel={searchActionLabel}
                  createBottleHref={createBottleHref}
                  createBottleLabel="Add a new bottle"
                />
                <Button onClick={startOver} variant="tonal" fullWidth>
                  Use a different photo
                </Button>
              </FormDetails>
            ) : createDecision ? (
              <FallbackActions
                searchHref={searchHref}
                searchLabel={searchActionLabel}
              />
            ) : null}
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
