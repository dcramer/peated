import { formatCategoryName } from "@peated/server/lib/format";
import type { Bottle } from "@peated/server/types";
import {
  Button,
  ButtonLink,
  FormStack,
  SelectedBottleSummary,
} from "@peated/web/components/designSystem/components";
import { Plus, Search } from "lucide-react";
import type { ReactNode } from "react";

import type { PhotoIdentification } from "./helpers";
import {
  BottlePhotoAction,
  BottleResolverColumn,
  BottleResolverInlineAction,
  BottleResolverIntroduction,
  BottleResolverSection,
} from "./layout.stylex";
import {
  FallbackActions,
  getPhotoFailureCopyPayload,
  LabelFacts,
  PhotoFailurePanel,
  type PhotoFailureTrace,
  PhotoIdentificationTraceFootnote,
} from "./panels";
import { PhotoPreview } from "./photoPreview.stylex";
import type {
  BottleResolverAction,
  BottleResolverCreateProposalActionsProps,
  BottleResolverMatchedAction,
  BottleResolverMatchedActionsProps,
} from "./types";

export function PhotoUploadState({
  search,
  searchHref,
  title,
  onSelectPhoto,
}: {
  search?: ReactNode;
  searchHref: string;
  title: string;
  onSelectPhoto: () => void;
}) {
  return (
    <BottleResolverColumn>
      <BottleResolverIntroduction
        description="Search the database, or photograph the front label and we’ll look."
        title={title}
      />
      {search ?? (
        <ButtonLink fullWidth href={searchHref} variant="accent">
          <Search aria-hidden="true" size={16} />
          Search bottles
        </ButtonLink>
      )}
      <BottlePhotoAction onSelectPhoto={onSelectPhoto} />
    </BottleResolverColumn>
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
  search,
  searchHref,
  onStartOver,
}: {
  previewUrl: string | null;
  search?: ReactNode;
  searchHref: string;
  onStartOver: () => void;
}) {
  return (
    <BottleResolverColumn>
      <BottleResolverInlineAction>
        <Button onClick={onStartOver} variant="text">
          Use a different photo
        </Button>
      </BottleResolverInlineAction>
      {previewUrl ? (
        <PhotoPreview
          loading
          metadata="Usually about a minute"
          src={previewUrl}
          title="Reading the label"
        />
      ) : null}
      <BottleResolverSection
        description="You can keep looking while we read the photo."
        title="Search by name instead"
      >
        {search ?? (
          <ButtonLink href={searchHref} variant="tonal">
            <Search aria-hidden="true" size={16} />
            Search bottles instead
          </ButtonLink>
        )}
      </BottleResolverSection>
    </BottleResolverColumn>
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
      <LabelFacts result={result} />
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
  onStartOver,
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
  onStartOver: () => void;
}) {
  if (matchedBottle) {
    return (
      <BottleResolverColumn>
        <BottleResolverInlineAction>
          <Button onClick={onStartOver} variant="text">
            Use a different photo
          </Button>
        </BottleResolverInlineAction>
        <BottleResolverSection
          description="Compare this record with the label before you continue."
          title="Check the bottle"
        >
          {previewUrl ? (
            <PhotoPreview
              metadata="Compare this photo with the record below"
              src={previewUrl}
              title="Label photo"
            />
          ) : null}
          <SelectedBottleSummary
            bottleId={matchedBottle.peatedId}
            imageUrl={matchedBottle.imageUrl}
            metadata={getMatchedBottleMetadata(matchedBottle)}
            name={matchedBottle.fullName}
          />
          <LabelFacts result={result} />
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
        </BottleResolverSection>
      </BottleResolverColumn>
    );
  }

  return (
    <BottleResolverColumn>
      <BottleResolverInlineAction>
        <Button onClick={onStartOver} variant="text">
          Use a different photo
        </Button>
      </BottleResolverInlineAction>
      <BottleResolverSection
        description={
          createProposalLabel?.description ??
          "Add a new bottle using this label."
        }
        title={proposedName ?? createProposalLabel?.title ?? "New bottle found"}
      >
        {previewUrl ? (
          <PhotoPreview
            metadata="Details read from this photo"
            src={previewUrl}
            title={proposedName ?? "Label photo"}
          />
        ) : null}
        <LabelFacts result={result} />
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
      </BottleResolverSection>
    </BottleResolverColumn>
  );
}

function getMatchedBottleMetadata(bottle: Bottle) {
  const release =
    bottle.releaseYear !== null &&
    !bottle.edition
      ?.toLocaleLowerCase()
      .includes(`${bottle.releaseYear} release`)
      ? `${bottle.releaseYear} release`
      : null;

  return [
    bottle.category ? formatCategoryName(bottle.category) : "Bottle record",
    bottle.edition,
    release,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}
