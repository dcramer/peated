import Button from "@peated/web/components/button";
import { Camera, Check, Plus, Search } from "lucide-react";
import type { ReactNode } from "react";

import { getMatchedCandidate, type PhotoIdentification } from "./helpers";
import {
  EvidencePills,
  FallbackActions,
  getPhotoFailureCopyPayload,
  PhotoFailurePanel,
  type PhotoFailureTrace,
  PhotoIdentificationTraceFootnote,
  PhotoResultCard,
  SearchBottleCallout,
} from "./panels";
import type {
  BottleResolverAction,
  BottleResolverCreateProposalActionsProps,
  BottleResolverMatchedAction,
  BottleResolverMatchedActionsProps,
} from "./types";

export function PhotoUploadState({
  searchHref,
  onSelectPhoto,
}: {
  searchHref: string;
  onSelectPhoto: () => void;
}) {
  return (
    <>
      <section className="px-3 sm:px-0">
        <div className="space-y-5">
          <div className="text-center">
            <div className="text-muted text-sm">Start with a bottle photo</div>
            <h2 className="mt-1 text-2xl font-semibold text-white">
              Capture the label, then confirm the match.
            </h2>
          </div>

          <button
            type="button"
            className="flex min-h-72 w-full flex-col items-center justify-center gap-4 rounded border border-slate-800 bg-slate-950 p-6 text-center transition hover:border-slate-700 hover:bg-black"
            onClick={onSelectPhoto}
          >
            <div className="rounded-full border border-slate-700 bg-slate-950 p-5">
              <Camera className="text-highlight h-10 w-10" />
            </div>
            <div>
              <div className="text-lg font-semibold text-white">
                Take or upload a photo
              </div>
              <div className="text-muted mt-1 text-sm">
                Use a clear bottle label for the fastest match.
              </div>
            </div>
          </button>
        </div>
      </section>
      <SearchBottleCallout searchHref={searchHref} />
    </>
  );
}

export function PhotoReadFailureState({
  previewUrl,
  photoError,
  searchHref,
  searchLabel,
  createBottleHref,
  trace,
  onStartOver,
}: {
  previewUrl: string;
  photoError: string;
  searchHref: string;
  searchLabel: string;
  createBottleHref: string | null;
  trace: PhotoFailureTrace | null;
  onStartOver: () => void;
}) {
  return (
    <>
      <PhotoFailurePanel
        previewUrl={previewUrl}
        title="We couldn't read that photo"
        description={photoError}
        searchHref={searchHref}
        searchLabel={searchLabel}
        createBottleHref={createBottleHref}
        onStartOver={onStartOver}
        variant="error"
      />
      {trace && (
        <PhotoIdentificationTraceFootnote
          traceId={trace.traceId}
          copyPayload={getPhotoFailureCopyPayload(trace)}
        />
      )}
    </>
  );
}

export function PhotoLoadingState({
  previewUrl,
  loadingMessage,
  searchHref,
}: {
  previewUrl: string | null;
  loadingMessage: string;
  searchHref: string;
}) {
  return (
    <section className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-3 py-8 text-center sm:min-h-0 sm:items-start sm:justify-start sm:py-10 sm:text-left">
      <div className="mx-auto max-w-md space-y-5 sm:flex sm:max-w-3xl sm:items-center sm:gap-8 sm:space-y-0">
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Selected bottle label"
            className="mx-auto h-28 w-28 rounded object-cover sm:mx-0 sm:h-56 sm:w-56"
          />
        )}
        <div>
          <h2 className="bottle-resolver-loading-shimmer via-highlight inline-block bg-gradient-to-r from-white to-white bg-[length:200%_100%] bg-clip-text text-xl font-semibold text-transparent">
            {loadingMessage}
          </h2>
          <p className="text-muted mt-2 text-sm">
            Reading the label and checking Peated for a match.
          </p>
          <p className="text-muted mt-1 text-sm">
            This can take up to 30 seconds.
          </p>
          <div className="mt-5">
            <Button href={searchHref} icon={<Search className="h-4 w-4" />}>
              Search Bottles
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PhotoNoMatchState({
  result,
  previewUrl,
  title,
  description,
  searchHref,
  searchLabel,
  createBottleHref,
  createBottleLabel,
  primaryAction,
  onStartOver,
}: {
  result: PhotoIdentification;
  previewUrl: string | null;
  title: string;
  description: string;
  searchHref: string;
  searchLabel: string;
  createBottleHref: string | null;
  createBottleLabel?: string;
  primaryAction?: "search" | "create";
  onStartOver: () => void;
}) {
  return (
    <PhotoFailurePanel
      previewUrl={previewUrl}
      title={title}
      description={description}
      searchHref={searchHref}
      searchLabel={searchLabel}
      createBottleHref={createBottleHref}
      createBottleLabel={createBottleLabel}
      primaryAction={primaryAction}
      onStartOver={onStartOver}
      variant="no-match"
    >
      <EvidencePills result={result} compact />
    </PhotoFailurePanel>
  );
}

export function PhotoMatchCreateState({
  result,
  previewUrl,
  matchedBottleId,
  matchedReleaseId,
  renderMatchedResultActions,
  renderCreateProposalActions,
  createProposalLabel,
  hasCreateDecision,
  proposedName,
  createPending,
  createActionLabel,
  resolvingAction,
  hasExactLibraryEntry,
  exactLibraryEntryImageUrl,
  pendingImage,
  loadingExactLibraryStatus,
  onLoadTarget,
  onAcceptCreateProposal,
}: {
  result: PhotoIdentification;
  previewUrl: string | null;
  matchedBottleId: number | null;
  matchedReleaseId: number | null;
  renderMatchedResultActions?: (
    props: BottleResolverMatchedActionsProps,
  ) => ReactNode;
  renderCreateProposalActions?: (
    props: BottleResolverCreateProposalActionsProps,
  ) => ReactNode;
  createProposalLabel: { title: string; description: string } | null;
  hasCreateDecision: boolean;
  proposedName: string | null;
  createPending: boolean;
  createActionLabel: string;
  resolvingAction: BottleResolverAction | null;
  hasExactLibraryEntry: boolean;
  exactLibraryEntryImageUrl?: string | null;
  pendingImage: PhotoIdentification["pendingImage"] | null;
  loadingExactLibraryStatus: boolean;
  onLoadTarget: (
    bottleId: number,
    releaseId: number | null,
    action?: BottleResolverMatchedAction,
  ) => void;
  onAcceptCreateProposal: (
    result: PhotoIdentification,
    action: BottleResolverAction,
  ) => void;
}) {
  const matchedCandidate = getMatchedCandidate(result);

  if (matchedBottleId) {
    const matchedName =
      matchedCandidate?.fullName ??
      matchedCandidate?.bottleFullName ??
      "Matched bottle";

    return (
      <section className="rounded border border-slate-800 bg-slate-950/50 p-4 lg:p-6">
        <div className="space-y-5">
          <PhotoResultCard
            previewUrl={previewUrl}
            title={matchedName}
            subtitle="Matched to existing bottle in Peated"
            fallbackIcon={<Check className="text-highlight h-6 w-6" />}
          >
            <EvidencePills result={result} compact />
          </PhotoResultCard>
          {renderMatchedResultActions ? (
            renderMatchedResultActions({
              bottleId: matchedBottleId,
              releaseId: matchedReleaseId,
              hasExactLibraryEntry,
              exactLibraryEntryImageUrl,
              pendingImage,
              loadingExactLibraryStatus,
              resolvingAction:
                resolvingAction === "create" ? null : resolvingAction,
              onResolve: (action) => {
                onLoadTarget(matchedBottleId, matchedReleaseId, action);
              },
            })
          ) : (
            <div className="mx-auto grid w-full gap-2 sm:w-1/2">
              <Button
                color="highlight"
                fullWidth
                disabled={Boolean(resolvingAction)}
                onClick={() => onLoadTarget(matchedBottleId, matchedReleaseId)}
              >
                Continue
              </Button>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded border border-slate-800 bg-slate-950/50 p-4 lg:p-6">
      <div className="space-y-5">
        <PhotoResultCard
          previewUrl={previewUrl}
          title={
            proposedName ?? createProposalLabel?.title ?? "New bottle found"
          }
          subtitle={
            createProposalLabel?.description ??
            "Create a new bottle from this label."
          }
          fallbackIcon={<Plus className="text-highlight h-6 w-6" />}
        >
          <EvidencePills result={result} compact />
        </PhotoResultCard>
        {hasCreateDecision && (
          <div
            className={
              renderCreateProposalActions
                ? "space-y-3"
                : "mx-auto grid w-full gap-2 sm:w-1/2"
            }
          >
            {renderCreateProposalActions ? (
              renderCreateProposalActions({
                createPending,
                resolvingAction,
                onResolve: (action) => onAcceptCreateProposal(result, action),
              })
            ) : (
              <Button
                color="highlight"
                fullWidth
                icon={<Plus className="h-4 w-4" />}
                onClick={() => onAcceptCreateProposal(result, "create")}
                disabled={createPending}
              >
                {createPending ? "Creating..." : createActionLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
