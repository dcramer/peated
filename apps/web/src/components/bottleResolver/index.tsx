"use client";

import FormError from "@peated/web/components/formError";
import Header from "@peated/web/components/header";
import Layout from "@peated/web/components/layout";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  createORPCResponseTraceContext,
  isORPCUnauthorizedRedirectError,
  type ORPCResponseTraceContext,
} from "@peated/web/lib/orpc/link";
import { useMutation } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import {
  canUseManualBottleCreate,
  createIdempotencyKey,
  getCreateBottlePrefill,
  getCreateDecision,
  getCreateNameSeed,
  getCreateProposalLabel,
  getManualResultCopy,
  getMatchedBottleId,
  getMatchedReleaseId,
  getProposedName,
  getSearchSeed,
  type PhotoIdentification,
  type PhotoIdentificationCreateInput,
} from "./helpers";
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
  BottleResolverTarget,
} from "./types";

export type {
  BottleResolverAction,
  BottleResolverCreateProposalActionsProps,
  BottleResolverMatchedAction,
  BottleResolverMatchedActionsProps,
  BottleResolverProps,
  BottleResolverTarget,
  PendingImageRef,
} from "./types";

const loadingMessages = [
  "Holding it up to the light",
  "Letting the label breathe",
  "Checking the dusty shelf",
  "Asking the tasting room",
  "Comparing the fine print",
];

export default function BottleResolver({
  onResolve,
  searchHrefForQuery,
  createBottleHrefForResult,
  title,
  renderMatchedResultActions,
  renderCreateProposalActions,
  createProposalActionLabel = "Continue",
  searchActionLabel = "Search Bottles",
}: BottleResolverProps) {
  const router = useRouter();
  const orpc = useORPC();
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
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [resolvingAction, setResolvingAction] =
    useState<BottleResolverAction | null>(null);
  const [matchedBottleStatus, setMatchedBottleStatus] = useState<{
    bottleId: number;
    releaseId: number | null;
    hasExactLibraryEntry: boolean;
    imageUrl: string | null;
    loading: boolean;
  } | null>(null);

  const photoIdentificationMutation = useMutation({
    mutationFn: async (
      {
        responseTraceContext,
        ...input
      }: {
        file: File;
        idempotencyKey: string;
        responseTraceContext: ORPCResponseTraceContext;
      },
      mutationContext,
    ) => {
      const { mutationFn } = orpc.tastings.photoIdentification.mutationOptions({
        context: { responseTraceContext },
      });
      return mutationFn!(input, mutationContext);
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
      const current = previewUrlRef.current;
      if (current && current !== transferredPreviewUrlRef.current) {
        URL.revokeObjectURL(current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isIdentifying) {
      setLoadingMessageIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setLoadingMessageIndex((index) => (index + 1) % loadingMessages.length);
    }, 2700);

    return () => window.clearInterval(timer);
  }, [isIdentifying]);

  function replacePreviewUrl(nextPreviewUrl: string | null) {
    setPreviewUrl((current) => {
      if (current && current !== transferredPreviewUrlRef.current) {
        URL.revokeObjectURL(current);
      }
      return nextPreviewUrl;
    });
  }

  async function resolveTarget(
    target: Omit<BottleResolverTarget, "pendingImage" | "previewUrl">,
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
        ...target,
        pendingImage: photoResult?.pendingImage ?? null,
        previewUrl: currentPreviewUrl,
        photoTrace,
      },
      action,
    );
    transferredPreviewUrlRef.current = currentPreviewUrl;
  }

  async function loadTarget(
    bottleId: number,
    releaseId: number | null = null,
    action?: BottleResolverMatchedAction,
  ) {
    setError(null);
    setResolvingAction(action ?? "library");
    try {
      const [bottle, release, collectionStatus] = await Promise.all([
        orpc.bottles.details.call({ bottle: bottleId }),
        releaseId
          ? orpc.bottleReleases.details.call({ release: releaseId })
          : Promise.resolve(null),
        orpc.collections.bottles.list.call({
          user: "me",
          collection: "library",
          bottle: bottleId,
          release: releaseId ?? undefined,
          baseOnly: releaseId == null,
        }),
      ]);
      const exactLibraryEntry = collectionStatus.results[0] ?? null;
      await resolveTarget(
        {
          bottle,
          release,
          hasExactLibraryEntry: Boolean(exactLibraryEntry),
          exactLibraryEntryImageUrl: exactLibraryEntry?.imageUrl ?? null,
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
          "We couldn't create that bottle from the photo. Search for the bottle to keep going.",
        );
        return;
      }

      const payload: PhotoIdentificationCreateInput = {
        createToken: result.createToken,
      };
      const created =
        await photoIdentificationCreateMutation.mutateAsync(payload);
      await resolveTarget(
        {
          bottle: created.bottle,
          release: created.release,
          hasExactLibraryEntry: false,
          resultSource: "created",
          warnings: (created.warnings ?? []).map(
            (warning) =>
              warning.message ||
              "The bottle was created, but the public image was not saved.",
          ),
        },
        action,
      );
    } catch (err) {
      if (isORPCUnauthorizedRedirectError(err)) return;

      logError(err);
      setError(
        "We couldn't create that bottle from the photo. Search for the bottle to keep going.",
      );
    } finally {
      setResolvingAction(null);
    }
  }

  async function identifyPhoto(file: File) {
    setError(null);
    setPhotoError(null);
    setPhotoResult(null);
    setPhotoIdentificationTraceId(null);
    setPhotoFailureTrace(null);

    const nextPreviewUrl = URL.createObjectURL(file);
    replacePreviewUrl(nextPreviewUrl);
    const idempotencyKey = createIdempotencyKey();
    const responseTraceContext = createORPCResponseTraceContext();

    try {
      const result = await photoIdentificationMutation.mutateAsync({
        file,
        idempotencyKey,
        responseTraceContext,
      });
      setPhotoResult(result);
      setPhotoIdentificationTraceId(responseTraceContext.sentryTraceId);
    } catch (err) {
      if (isORPCUnauthorizedRedirectError(err)) return;

      logError(err, {
        context: "add_bottle_photo_identification",
        rpc: "tastings.photoIdentification",
        file: {
          size: file.size,
          type: file.type || null,
        },
      });
      setPhotoError(
        "We couldn't read that photo. Search can still find the bottle, or you can try another photo.",
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
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    void identifyPhoto(file);
    event.target.value = "";
  }

  function startOver() {
    setError(null);
    setPhotoError(null);
    setPhotoResult(null);
    setPhotoIdentificationTraceId(null);
    setPhotoFailureTrace(null);
    setMatchedBottleStatus(null);
    replacePreviewUrl(null);
  }

  const matchedBottleId = getMatchedBottleId(photoResult);
  const matchedReleaseId = getMatchedReleaseId(photoResult);
  const createDecision = getCreateDecision(photoResult);
  const proposedName = getProposedName(photoResult);
  const createProposalLabel = getCreateProposalLabel(photoResult);
  const defaultSearchHref = searchHrefForQuery();
  const searchSeed = getSearchSeed(photoResult);
  const searchHref = searchHrefForQuery(searchSeed, photoResult?.pendingImage);
  const createBottlePrefill = getCreateBottlePrefill(photoResult);
  const createBottleHref =
    photoResult &&
    createBottleHrefForResult &&
    canUseManualBottleCreate(photoResult)
      ? createBottleHrefForResult(
          getCreateNameSeed(photoResult),
          createBottlePrefill,
          photoResult.pendingImage,
        )
      : null;
  const manualResultCopy = getManualResultCopy(photoResult);
  const matchedBottleHasExactLibraryEntry =
    matchedBottleStatus?.bottleId === matchedBottleId &&
    matchedBottleStatus.releaseId === matchedReleaseId
      ? matchedBottleStatus.hasExactLibraryEntry
      : false;
  const matchedBottleExactLibraryStatusLoading =
    Boolean(matchedBottleId) &&
    (matchedBottleStatus?.bottleId !== matchedBottleId ||
      matchedBottleStatus?.releaseId !== matchedReleaseId ||
      matchedBottleStatus.loading);

  useEffect(() => {
    if (!matchedBottleId) {
      setMatchedBottleStatus(null);
      return;
    }

    const statusBottleId = matchedBottleId;
    const statusReleaseId = matchedReleaseId;
    let cancelled = false;
    setMatchedBottleStatus({
      bottleId: statusBottleId,
      releaseId: statusReleaseId,
      hasExactLibraryEntry: false,
      imageUrl: null,
      loading: true,
    });

    async function loadMatchedBottleStatus() {
      try {
        const collectionStatus = await orpc.collections.bottles.list.call({
          user: "me",
          collection: "library",
          bottle: statusBottleId,
          release: statusReleaseId ?? undefined,
          baseOnly: statusReleaseId == null,
        });
        const exactLibraryEntry = collectionStatus.results[0] ?? null;
        if (cancelled) return;
        setMatchedBottleStatus({
          bottleId: statusBottleId,
          releaseId: statusReleaseId,
          hasExactLibraryEntry: Boolean(exactLibraryEntry),
          imageUrl: exactLibraryEntry?.imageUrl ?? null,
          loading: false,
        });
      } catch (err) {
        logError(err);
        if (cancelled) return;
        setMatchedBottleStatus({
          bottleId: statusBottleId,
          releaseId: statusReleaseId,
          hasExactLibraryEntry: false,
          imageUrl: null,
          loading: false,
        });
      }
    }

    void loadMatchedBottleStatus();

    return () => {
      cancelled = true;
    };
  }, [matchedBottleId, matchedReleaseId, orpc]);

  return (
    <Layout
      footer={null}
      header={
        <Header>
          <div className="flex w-full items-center gap-3">
            <button
              type="button"
              aria-label="Back"
              className="text-muted group flex justify-center lg:hidden"
              onClick={() => router.back()}
            >
              <div className="-my-1 rounded bg-slate-800 p-1 group-hover:bg-slate-700 group-hover:text-white">
                <ChevronLeft className="h-8 w-8" />
              </div>
            </button>
            <h1 className="text-2xl font-bold">{title}</h1>
          </div>
        </Header>
      }
    >
      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFileChange}
      />

      <div className="mx-auto mt-5 max-w-3xl space-y-5">
        {!previewUrl && !photoResult && !isIdentifying && (
          <PhotoUploadState
            searchHref={defaultSearchHref}
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
            loadingMessage={loadingMessages[loadingMessageIndex]}
            searchHref={defaultSearchHref}
          />
        )}

        {!isIdentifying && photoResult && (
          <>
            {matchedBottleId || createDecision ? (
              <PhotoMatchCreateState
                result={photoResult}
                previewUrl={previewUrl}
                matchedBottleId={matchedBottleId}
                matchedReleaseId={matchedReleaseId}
                renderMatchedResultActions={renderMatchedResultActions}
                renderCreateProposalActions={renderCreateProposalActions}
                createProposalLabel={createProposalLabel}
                hasCreateDecision={Boolean(createDecision)}
                proposedName={proposedName}
                createPending={photoIdentificationCreateMutation.isPending}
                createActionLabel={createProposalActionLabel}
                resolvingAction={resolvingAction}
                hasExactLibraryEntry={matchedBottleHasExactLibraryEntry}
                exactLibraryEntryImageUrl={matchedBottleStatus?.imageUrl}
                pendingImage={photoResult.pendingImage}
                loadingExactLibraryStatus={
                  matchedBottleExactLibraryStatusLoading
                }
                onLoadTarget={(bottleId, releaseId, action) => {
                  void loadTarget(bottleId, releaseId, action);
                }}
                onAcceptCreateProposal={(result, action) => {
                  void acceptCreateProposal(result, action);
                }}
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
            {(matchedBottleId || createDecision) && (
              <FallbackActions
                searchHref={searchHref}
                searchLabel={searchActionLabel}
                createBottleHref={matchedBottleId ? createBottleHref : null}
                showStartOver
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
          </>
        )}

        {error && <FormError values={[error]} />}

        <style jsx global>{`
          @keyframes bottle-resolver-loading-shimmer {
            0% {
              background-position: 200% 0;
            }
            100% {
              background-position: -200% 0;
            }
          }

          .bottle-resolver-loading-shimmer {
            animation: bottle-resolver-loading-shimmer 2.4s ease-in-out infinite;
          }
        `}</style>
      </div>
    </Layout>
  );
}
