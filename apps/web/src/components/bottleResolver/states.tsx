import type { Bottle } from "@peated/server/types";
import { BottleMatchList } from "@peated/web/components/bottleMatchList.stylex";
import { Button, ButtonLink } from "@peated/web/components/button.stylex";
import {
  FormDetails,
  FormNotice,
  FormStack,
} from "@peated/web/components/formLayout.stylex";
import { SelectedBottleSummary } from "@peated/web/components/selectedBottleSummary.stylex";
import { Plus, Search } from "lucide-react";
import type { ReactNode } from "react";

import {
  getLabelSummary,
  getPhotoProgressStatus,
  hasRecognizedLabelDetails,
  type PhotoIdentification,
  type PhotoMatchCandidate,
  type PhotoProgress,
} from "./helpers";
import {
  BottlePhotoAction,
  BottleResolverActionGrid,
  BottleResolverColumn,
  BottleResolverInlineAction,
  BottleResolverIntroduction,
  BottleResolverSection,
  BottleResolverTextActions,
} from "./layout.stylex";
import { LabelFacts } from "./panels";
import { PhotoPreview } from "./photoPreview.stylex";
import type {
  BottleResolverAction,
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

export function PhotoLoadingState({
  previewUrl,
  progress,
  identifying,
  slow,
  pickingBottleId,
  search,
  searchHref,
  onPickMatch,
  onStartOver,
}: {
  previewUrl: string | null;
  progress: PhotoProgress;
  identifying: boolean;
  slow: boolean;
  pickingBottleId: number | null;
  search?: ReactNode;
  searchHref: string;
  onPickMatch: (bottle: PhotoMatchCandidate) => void;
  onStartOver: () => void;
}) {
  const pickingBottle = progress.candidates.find(
    (bottle) => bottle.id === pickingBottleId,
  );
  return (
    <BottleResolverColumn>
      <BottleResolverInlineAction>
        <Button onClick={onStartOver} variant="text">
          Use a different photo
        </Button>
      </BottleResolverInlineAction>
      {previewUrl ? (
        <PhotoPreview
          loading={identifying || Boolean(pickingBottle)}
          metadata={
            slow && identifying ? "This one is taking a while." : undefined
          }
          src={previewUrl}
          title={
            identifying || pickingBottle
              ? getPhotoProgressStatus(progress)
              : "Stopped looking."
          }
        />
      ) : null}
      {progress.candidates.length ? (
        <BottleResolverSection title="Possible matches">
          <BottleMatchList
            bottles={progress.candidates}
            onUse={onPickMatch}
            pendingBottleId={pickingBottleId}
          />
        </BottleResolverSection>
      ) : null}
      {progress.imageEvidence ? (
        <FormDetails
          compact
          description={getLabelSummary(progress.imageEvidence)}
          title="Label details"
        >
          <LabelFacts result={{ imageEvidence: progress.imageEvidence }} />
        </FormDetails>
      ) : null}
      <BottleResolverSection title="Search by name instead">
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

export function PhotoMatchState({
  result,
  previewUrl,
  matchedBottle,
  renderMatchedResultActions,
  resolvingAction,
  hasLibraryEntry,
  libraryEntryImageUrl,
  pendingImage,
  loadingExactLibraryStatus,
  onLoadBottle,
  reportingWrongMatch = false,
  onWrongMatch,
}: {
  result: PhotoIdentification;
  previewUrl: string | null;
  matchedBottle: Bottle;
  renderMatchedResultActions?: (
    props: BottleResolverMatchedActionsProps,
  ) => ReactNode;
  resolvingAction: BottleResolverAction | null;
  hasLibraryEntry: boolean;
  libraryEntryImageUrl?: string | null;
  pendingImage: PhotoIdentification["pendingImage"] | null;
  loadingExactLibraryStatus: boolean;
  onLoadBottle: (bottle: Bottle, action?: BottleResolverMatchedAction) => void;
  reportingWrongMatch?: boolean;
  /** Reports the matched Bottle as wrong and opens the fallback screen. */
  onWrongMatch?: () => void;
}) {
  return (
    <BottleResolverColumn>
      <BottleResolverSection>
        <SelectedBottleSummary bottle={matchedBottle} />
        <FormNotice>
          Check the edition and strength against your label.
        </FormNotice>
        {renderMatchedResultActions ? (
          renderMatchedResultActions({
            bottle: matchedBottle,
            hasLibraryEntry,
            libraryEntryImageUrl,
            pendingImage,
            loadingExactLibraryStatus,
            resolvingAction:
              resolvingAction === "create" ? null : resolvingAction,
            // The member just rejected this Bottle; don't continue with it.
            disabled: reportingWrongMatch,
            onResolve: (action) => {
              onLoadBottle(matchedBottle, action);
            },
          })
        ) : (
          <Button
            disabled={Boolean(resolvingAction) || reportingWrongMatch}
            fullWidth
            onClick={() => onLoadBottle(matchedBottle)}
            variant="accent"
          >
            Continue
          </Button>
        )}
        {onWrongMatch ? (
          <Button
            disabled={Boolean(resolvingAction) || reportingWrongMatch}
            fullWidth
            loading={reportingWrongMatch}
            onClick={onWrongMatch}
            variant="text"
          >
            Not my bottle
          </Button>
        ) : null}
        <LabelDetails previewUrl={previewUrl} result={result} />
      </BottleResolverSection>
    </BottleResolverColumn>
  );
}

/**
 * The one screen for every photo that did not lead straight to a Bottle:
 * a wrong match, no match, a new Bottle, or a photo we could not check.
 * Only the reason line, the suggestions, and the main action change.
 */
export function PhotoFallbackState({
  result,
  previewUrl,
  reason,
  alert = false,
  suggestions,
  pickingBottleId = null,
  onPickSuggestion,
  proposal = null,
  createBottleHref,
  searchHref,
  searchLabel,
  onStartOver,
}: {
  result: PhotoIdentification | null;
  previewUrl: string | null;
  reason: string;
  /** Announces the reason when the lookup itself failed. */
  alert?: boolean;
  /** Other Bottles the lookup considered; picking one continues with it. */
  suggestions: readonly PhotoMatchCandidate[];
  pickingBottleId?: number | null;
  onPickSuggestion: (bottle: PhotoMatchCandidate) => void;
  /** An approved new Bottle: its name and the actions that add it. */
  proposal?: { name: string; actions: ReactNode } | null;
  createBottleHref: string | null;
  searchHref: string;
  searchLabel: string;
  onStartOver: () => void;
}) {
  const reasonLine = alert ? <span role="alert">{reason}</span> : reason;
  const startOver = (
    <Button onClick={onStartOver} variant="text">
      Start over
    </Button>
  );
  const searchLink = (variant: "accent" | "tonal" | "text") => (
    <ButtonLink
      fullWidth={variant !== "text"}
      href={searchHref}
      variant={variant}
    >
      {variant === "text" ? null : <Search aria-hidden="true" size={16} />}
      {searchLabel}
    </ButtonLink>
  );
  const createLink = (variant: "accent" | "tonal") =>
    createBottleHref ? (
      <ButtonLink fullWidth href={createBottleHref} variant={variant}>
        <Plus aria-hidden="true" size={16} />
        Add a new bottle
      </ButtonLink>
    ) : null;
  const suggestionList = (
    <BottleMatchList
      bottles={suggestions}
      onUse={onPickSuggestion}
      pendingBottleId={pickingBottleId}
    />
  );

  // One accent action per view (DESIGN.md), and one heading that says what to
  // do next: add the approved new Bottle, pick a suggestion, or find it.
  if (proposal) {
    return (
      <BottleResolverColumn>
        {/* One tap adds this Bottle, so what we read stays in view. */}
        <BottleResolverSection description={reasonLine} title={proposal.name}>
          {previewUrl ? (
            <PhotoPreview
              metadata="Details read from your photo"
              src={previewUrl}
              title="Label photo"
            />
          ) : null}
          <LabelFacts result={result} />
          {proposal.actions}
        </BottleResolverSection>
        {suggestions.length ? (
          <BottleResolverSection title="Or is it one of these?">
            {suggestionList}
          </BottleResolverSection>
        ) : null}
        <BottleResolverTextActions>
          {searchLink("text")}
          {startOver}
        </BottleResolverTextActions>
      </BottleResolverColumn>
    );
  }

  if (suggestions.length) {
    return (
      <BottleResolverColumn>
        <BottleResolverSection
          description={reasonLine}
          title="Is it one of these?"
        >
          {suggestionList}
        </BottleResolverSection>
        <FormStack>
          <BottleResolverActionGrid>
            {searchLink("tonal")}
            {createLink("tonal")}
          </BottleResolverActionGrid>
          <BottleResolverTextActions>{startOver}</BottleResolverTextActions>
        </FormStack>
        <LabelDetails previewUrl={previewUrl} result={result} />
      </BottleResolverColumn>
    );
  }

  // Nothing to suggest: add the Bottle when the label was read, else search.
  const createFirst = Boolean(
    createBottleHref && hasRecognizedLabelDetails(result),
  );
  return (
    <BottleResolverColumn>
      <BottleResolverSection description={reasonLine} title="Find your bottle">
        {/* A failed lookup keeps the photo in view (feature doc rule). */}
        {alert && previewUrl ? (
          <PhotoPreview
            metadata="We couldn't check this photo"
            src={previewUrl}
            title="Label photo"
          />
        ) : null}
        <FormStack>
          {createFirst ? createLink("accent") : searchLink("accent")}
          {createFirst ? searchLink("tonal") : createLink("tonal")}
          <BottleResolverTextActions>{startOver}</BottleResolverTextActions>
        </FormStack>
      </BottleResolverSection>
      {alert ? null : <LabelDetails previewUrl={previewUrl} result={result} />}
    </BottleResolverColumn>
  );
}

function LabelDetails({
  previewUrl,
  result,
}: {
  previewUrl: string | null;
  result: PhotoIdentification | null;
}) {
  if (!previewUrl && !hasRecognizedLabelDetails(result)) return null;
  return (
    <FormDetails compact title="Label details">
      {previewUrl ? (
        <PhotoPreview
          metadata="Details read from your photo"
          src={previewUrl}
          title="Label photo"
        />
      ) : null}
      <LabelFacts result={result} />
    </FormDetails>
  );
}
