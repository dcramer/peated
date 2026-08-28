import type { Bottle } from "@peated/server/types";
import {
  Button,
  ButtonLink,
  FormSection,
  FormStack,
  LoadingList,
  SelectedBottleSummary,
} from "@peated/web/components/designSystem/components";
import { Camera, Plus, Search } from "lucide-react";
import type { ReactNode } from "react";

import type { PhotoIdentification } from "./helpers";
import {
  EvidencePills,
  FallbackActions,
  getPhotoFailureCopyPayload,
  PhotoFailurePanel,
  type PhotoFailureTrace,
  PhotoIdentificationTraceFootnote,
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
    <FormStack>
      <FormSection
        description="Use a clear photo of the front label for the fastest match."
        title="Capture the label, then confirm the match"
      >
        <Button fullWidth onClick={onSelectPhoto} size="lg" variant="accent">
          <Camera aria-hidden="true" size={18} />
          Take or upload a photo
        </Button>
      </FormSection>
      <FormSection
        description="Find a bottle in the catalog or add one manually."
        title="Prefer to search?"
      >
        <ButtonLink fullWidth href={searchHref} variant="tonal">
          <Search aria-hidden="true" size={16} />
          Search bottles
        </ButtonLink>
      </FormSection>
    </FormStack>
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
    <FormStack>
      {previewUrl ? (
        <SelectedBottleSummary
          bottleId="Reading label"
          imageUrl={previewUrl}
          metadata="Checking the catalog"
          name={loadingMessage}
        />
      ) : null}
      <FormSection
        description="Reading the label and checking the catalog. This can take up to 30 seconds."
        title={loadingMessage}
      >
        <LoadingList label="Identifying bottle" rows={3} />
        <ButtonLink href={searchHref} variant="tonal">
          <Search aria-hidden="true" size={16} />
          Search bottles instead
        </ButtonLink>
      </FormSection>
    </FormStack>
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
      <EvidencePills result={result} />
    </PhotoFailurePanel>
  );
}

export function PhotoMatchCreateState({
  result,
  previewUrl,
  matchedBottle,
  renderMatchedResultActions,
  renderCreateProposalActions,
  createProposalLabel,
  hasCreateDecision,
  proposedName,
  createPending,
  createActionLabel,
  resolvingAction,
  hasLibraryEntry,
  libraryEntryImageUrl,
  pendingImage,
  loadingExactLibraryStatus,
  onLoadBottle,
  onAcceptCreateProposal,
}: {
  result: PhotoIdentification;
  previewUrl: string | null;
  matchedBottle: Bottle | null;
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
  hasLibraryEntry: boolean;
  libraryEntryImageUrl?: string | null;
  pendingImage: PhotoIdentification["pendingImage"] | null;
  loadingExactLibraryStatus: boolean;
  onLoadBottle: (bottle: Bottle, action?: BottleResolverMatchedAction) => void;
  onAcceptCreateProposal: (
    result: PhotoIdentification,
    action: BottleResolverAction,
  ) => void;
}) {
  if (matchedBottle) {
    return (
      <FormSection
        description="Matched to an existing bottle in the catalog."
        title="Matched bottle"
      >
        <SelectedBottleSummary
          bottleId={matchedBottle.peatedId}
          imageUrl={previewUrl ?? matchedBottle.imageUrl}
          metadata={matchedBottle.category ?? "Catalog bottle"}
          name={matchedBottle.fullName}
        />
        <EvidencePills result={result} />
        {renderMatchedResultActions ? (
          renderMatchedResultActions({
            bottle: matchedBottle,
            hasLibraryEntry,
            libraryEntryImageUrl,
            pendingImage,
            loadingExactLibraryStatus,
            resolvingAction:
              resolvingAction === "create" ? null : resolvingAction,
            onResolve: (action) => {
              onLoadBottle(matchedBottle, action);
            },
          })
        ) : (
          <Button
            disabled={Boolean(resolvingAction)}
            fullWidth
            onClick={() => onLoadBottle(matchedBottle)}
            variant="accent"
          >
            Continue
          </Button>
        )}
      </FormSection>
    );
  }

  return (
    <FormSection
      description={
        createProposalLabel?.description ??
        "Create a new bottle from this label."
      }
      title={proposedName ?? createProposalLabel?.title ?? "New bottle found"}
    >
      {previewUrl ? (
        <SelectedBottleSummary
          bottleId="New bottle"
          imageUrl={previewUrl}
          metadata="Read from label"
          name={proposedName ?? "Bottle preview"}
        />
      ) : null}
      <EvidencePills result={result} />
      {hasCreateDecision && (
        <FormStack>
          {renderCreateProposalActions ? (
            renderCreateProposalActions({
              createPending,
              resolvingAction,
              onResolve: (action) => onAcceptCreateProposal(result, action),
            })
          ) : (
            <Button
              disabled={createPending}
              fullWidth
              loading={createPending}
              onClick={() => onAcceptCreateProposal(result, "create")}
              variant="accent"
            >
              <Plus aria-hidden="true" size={16} />
              {createActionLabel}
            </Button>
          )}
        </FormStack>
      )}
    </FormSection>
  );
}
