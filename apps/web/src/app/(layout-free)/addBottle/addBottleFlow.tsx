"use client";

import type { Outputs } from "@peated/server/orpc/router";
import type { Bottle } from "@peated/server/types";
import {
  Button,
  ButtonLink,
  CollectionBottleStatusChips,
  FormGrid,
  FormNotice,
  FormSection,
  FormStack,
  LoadingList,
  SelectedBottleSummary,
  type CollectionBottleStatusValue,
} from "@peated/web/components";
import BottleResolver, {
  type BottleResolverAction,
  type BottleResolverCreateProposalActionsProps,
  type BottleResolverMatchedActionsProps,
  type BottleResolverResult,
  type PendingImageRef,
} from "@peated/web/components/bottleResolver";
import { PhotoIdentificationTraceFootnote } from "@peated/web/components/bottleResolver/panels";
import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import type { CreateBottlePrefill } from "@peated/web/components/search/createBottleHref";
import { getCreateBottleHref } from "@peated/web/components/search/createBottleHref";
import { Search as BottleSearch } from "@peated/web/components/search/search.stylex";
import TastingForm, {
  TastingFormLoading,
  type MemberReviewFormSubmitData,
  type TastingCreateFormSubmitData,
} from "@peated/web/components/tastingForm";
import { WorkflowScreen } from "@peated/web/components/workflowScreen.stylex";
import useAuth from "@peated/web/hooks/useAuth";
import { AuthRequired } from "@peated/web/hooks/useAuthRequired";
import {
  getAddBottleHref,
  getPendingImageFromParams,
} from "@peated/web/lib/addBottle";
import { toBlob } from "@peated/web/lib/blobs";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { uploadImageAfterSave } from "@peated/web/lib/imageUpload";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import type { TastingTagSuggestion } from "@peated/web/lib/tastingForm";
import { getBottleUrl } from "@peated/web/lib/urls";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Eye, Plus, RotateCcw, Search, Wine } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BadgeAwardMessage } from "./badgeAwardMessage.stylex";

type AddBottleIntent = "catalog" | "choose" | "library" | "tasting" | "view";
type CollectionBottle = Outputs["collections"]["bottles"]["create"];
type FlowBottle = BottleResolverResult;
type SuggestedTags = { results: TastingTagSuggestion[] };
type TastingSubmitData = TastingCreateFormSubmitData;
type TastingDraft = FlowBottle & {
  suggestedTags: SuggestedTags;
  createdAt: string;
};

function getIntent(value: string | null): AddBottleIntent {
  if (
    value === "catalog" ||
    value === "library" ||
    value === "tasting" ||
    value === "view"
  ) {
    return value;
  }
  return "choose";
}

function getCreateReturnAction(intent: AddBottleIntent) {
  return intent;
}

function getFlowTitle(intent: AddBottleIntent) {
  if (intent === "catalog") return "Add a bottle";
  if (intent === "library") return "Add to your Library";
  if (intent === "tasting") return "Log a tasting";
  return "Find a bottle";
}

function parseId(value: string | null) {
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function getSearchHref(
  query = "",
  intent: AddBottleIntent = "choose",
  pendingImage?: PendingImageRef | null,
) {
  const params = new URLSearchParams({
    intent,
  });
  if (query) params.set("q", query);
  if (pendingImage?.id) params.set("pendingImageId", pendingImage.id);
  if (pendingImage?.imageUrl) {
    params.set("pendingImageUrl", pendingImage.imageUrl);
  }
  return `/search?${params.toString()}`;
}

function getViewBottleHref(bottle: Bottle) {
  return getBottleUrl(bottle);
}

function canSaveBottleToLibrary(selection: FlowBottle) {
  return (
    !selection.hasLibraryEntry ||
    Boolean(selection.pendingImage && selection.libraryEntryImageUrl === null)
  );
}

function getLibraryActionLabel(state: {
  hasLibraryEntry: boolean;
  canSaveLibraryPhoto?: boolean;
}) {
  if (!state.hasLibraryEntry) return "Add to Library";
  return state.canSaveLibraryPhoto ? "Save photo" : "In Library";
}

function BottlePanel({
  bottle,
  previewUrl,
}: {
  bottle: Bottle;
  previewUrl?: string | null;
}) {
  return (
    <SelectedBottleSummary
      bottle={bottle}
      imageUrl={previewUrl ?? bottle.imageUrl}
    />
  );
}

function CollectionBottlePanel({ entry }: { entry: CollectionBottle }) {
  return (
    <SelectedBottleSummary
      bottle={entry.bottle}
      imageUrl={entry.imageUrl ?? entry.bottle.imageUrl}
    />
  );
}

function LoadingBottlePanel({
  intent,
  title,
}: {
  intent: AddBottleIntent;
  title: string;
}) {
  if (intent === "tasting") {
    return <TastingFormLoading title={title} />;
  }

  return (
    <WorkflowScreen title={title}>
      <LoadingList label="Loading bottle" rows={3} />
    </WorkflowScreen>
  );
}

function revokeBlobPreviewUrl(selection: FlowBottle) {
  if (selection.previewUrl?.startsWith("blob:")) {
    URL.revokeObjectURL(selection.previewUrl);
  }
}

function BottleLoadErrorPanel({
  message,
  onStartOver,
  title,
}: {
  message: string;
  onStartOver: () => void;
  title: string;
}) {
  return (
    <WorkflowScreen title={title}>
      <FormStack>
        <FormNotice>{message}</FormNotice>
        <FormGrid>
          <ButtonLink fullWidth href={getSearchHref()}>
            <Search aria-hidden="true" size={16} />
            Search bottles
          </ButtonLink>
          <Button fullWidth onClick={onStartOver} variant="tonal">
            <RotateCcw aria-hidden="true" size={16} />
            Start over
          </Button>
        </FormGrid>
      </FormStack>
    </WorkflowScreen>
  );
}

function OutcomeButton({
  href,
  onClick,
  children,
  icon,
  emphasized,
  disabled,
  loading,
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  icon: ReactNode;
  emphasized?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  if (href) {
    return (
      <ButtonLink
        fullWidth
        href={href}
        variant={emphasized ? "accent" : "tonal"}
      >
        {icon}
        {children}
      </ButtonLink>
    );
  }

  return (
    <Button
      disabled={disabled}
      fullWidth
      loading={loading}
      onClick={onClick}
      variant={emphasized ? "accent" : "tonal"}
    >
      {icon}
      {children}
    </Button>
  );
}

function MatchedOutcomeActions({
  bottle,
  hasLibraryEntry,
  libraryEntryImageUrl,
  pendingImage,
  loadingExactLibraryStatus,
  resolvingAction,
  intent,
  onResolve,
}: BottleResolverMatchedActionsProps & { intent: AddBottleIntent }) {
  const canSaveLibraryPhoto = Boolean(
    pendingImage && hasLibraryEntry && libraryEntryImageUrl === null,
  );
  const primaryAction =
    intent === "tasting"
      ? "tasting"
      : intent === "catalog" || intent === "view"
        ? "view"
        : intent === "library"
          ? "library"
          : null;
  const libraryButton = (
    <OutcomeButton
      key="library"
      onClick={() => onResolve("library")}
      icon={<BookOpen aria-hidden="true" size={16} />}
      emphasized={primaryAction === "library"}
      disabled={
        Boolean(resolvingAction) ||
        loadingExactLibraryStatus ||
        (hasLibraryEntry && !canSaveLibraryPhoto)
      }
      loading={resolvingAction === "library" || loadingExactLibraryStatus}
    >
      {getLibraryActionLabel({ hasLibraryEntry, canSaveLibraryPhoto })}
    </OutcomeButton>
  );
  const tastingButton = (
    <OutcomeButton
      key="tasting"
      onClick={() => onResolve("tasting")}
      icon={<Wine aria-hidden="true" size={16} />}
      emphasized={primaryAction === "tasting"}
      disabled={Boolean(resolvingAction)}
      loading={resolvingAction === "tasting"}
    >
      Log a tasting
    </OutcomeButton>
  );
  const viewButton = (
    <OutcomeButton
      key="view"
      href={getViewBottleHref(bottle)}
      icon={<Eye aria-hidden="true" size={16} />}
      emphasized={primaryAction === "view"}
    >
      View bottle
    </OutcomeButton>
  );
  const actionButtons =
    intent === "tasting"
      ? [tastingButton, libraryButton, viewButton]
      : intent === "catalog" || intent === "view"
        ? [viewButton, libraryButton, tastingButton]
        : [libraryButton, tastingButton, viewButton];
  const [primaryButton, ...secondaryButtons] = actionButtons;

  return (
    <FormStack>
      {primaryButton}
      <FormGrid>{secondaryButtons}</FormGrid>
    </FormStack>
  );
}

function CreateProposalOutcomeActions({
  createPending,
  resolvingAction,
  intent,
  onResolve,
}: BottleResolverCreateProposalActionsProps & { intent: AddBottleIntent }) {
  const creating = createPending || Boolean(resolvingAction);
  const primaryAction =
    intent === "tasting"
      ? "tasting"
      : intent === "catalog" || intent === "view"
        ? "create"
        : intent === "library"
          ? "library"
          : null;
  const libraryButton = (
    <OutcomeButton
      key="library"
      onClick={() => onResolve("library")}
      icon={<BookOpen aria-hidden="true" size={16} />}
      emphasized={primaryAction === "library"}
      disabled={creating}
      loading={resolvingAction === "library"}
    >
      Add to Library
    </OutcomeButton>
  );
  const tastingButton = (
    <OutcomeButton
      key="tasting"
      onClick={() => onResolve("tasting")}
      icon={<Wine aria-hidden="true" size={16} />}
      emphasized={primaryAction === "tasting"}
      disabled={creating}
      loading={resolvingAction === "tasting"}
    >
      Log a tasting
    </OutcomeButton>
  );
  const createButton = (
    <OutcomeButton
      key="create"
      onClick={() => onResolve("create")}
      icon={<Plus aria-hidden="true" size={16} />}
      emphasized={primaryAction === "create"}
      disabled={creating}
      loading={resolvingAction === "create"}
    >
      Add a bottle
    </OutcomeButton>
  );
  const actionButtons =
    intent === "tasting"
      ? [tastingButton, libraryButton, createButton]
      : intent === "catalog" || intent === "view"
        ? [createButton, libraryButton, tastingButton]
        : [libraryButton, tastingButton, createButton];
  const [primaryButton, ...secondaryButtons] = actionButtons;

  return (
    <FormStack>
      {primaryButton}
      <FormGrid>{secondaryButtons}</FormGrid>
    </FormStack>
  );
}

function OutcomeSelection({
  selection,
  intent,
  onAddToLibrary,
  onLogTasting,
  onStartOver,
  addingToLibrary,
  loggingTasting,
  error,
}: {
  selection: FlowBottle;
  intent: AddBottleIntent;
  onAddToLibrary: () => void;
  onLogTasting: () => void;
  onStartOver: () => void;
  addingToLibrary: boolean;
  loggingTasting: boolean;
  error?: string;
}) {
  const wasCreated = selection.resultSource === "created";
  const title = wasCreated ? "Bottle added" : "Bottle found";
  const description = wasCreated
    ? "Choose what you want to do next."
    : "Choose what you want to do with this bottle.";
  const canSaveLibrary = canSaveBottleToLibrary(selection);
  const primaryAction =
    intent === "tasting"
      ? "tasting"
      : intent === "catalog" || intent === "view"
        ? "view"
        : intent === "library" && canSaveLibrary
          ? "library"
          : null;
  const libraryButton = (
    <OutcomeButton
      key="library"
      onClick={onAddToLibrary}
      icon={<BookOpen aria-hidden="true" size={16} />}
      emphasized={primaryAction === "library"}
      disabled={!canSaveLibrary || addingToLibrary || loggingTasting}
      loading={addingToLibrary}
    >
      {getLibraryActionLabel({
        hasLibraryEntry: selection.hasLibraryEntry,
        canSaveLibraryPhoto: Boolean(
          selection.pendingImage && selection.libraryEntryImageUrl === null,
        ),
      })}
    </OutcomeButton>
  );
  const tastingButton = (
    <OutcomeButton
      key="tasting"
      onClick={onLogTasting}
      icon={<Wine aria-hidden="true" size={16} />}
      emphasized={primaryAction === "tasting"}
      disabled={loggingTasting}
      loading={loggingTasting}
    >
      Log a tasting
    </OutcomeButton>
  );
  const viewButton = (
    <OutcomeButton
      key="view"
      href={getViewBottleHref(selection.bottle)}
      icon={<Eye aria-hidden="true" size={16} />}
      emphasized={primaryAction === "view"}
    >
      View bottle
    </OutcomeButton>
  );
  const actionButtons =
    intent === "tasting"
      ? [tastingButton, libraryButton, viewButton]
      : intent === "catalog" || intent === "view"
        ? [viewButton, libraryButton, tastingButton]
        : [libraryButton, tastingButton, viewButton];

  return (
    <WorkflowScreen title={getFlowTitle(intent)}>
      <FormStack>
        <BottlePanel
          bottle={selection.bottle}
          previewUrl={selection.previewUrl}
        />
        {selection.warnings?.length ? (
          <FormNotice>{selection.warnings.join(" ")}</FormNotice>
        ) : null}
        {error ? <FormNotice>{error}</FormNotice> : null}
        <FormSection description={description} title={title}>
          <FormGrid>{actionButtons}</FormGrid>
        </FormSection>
        <FormGrid>
          <ButtonLink
            fullWidth
            href={getSearchHref("", intent, selection.pendingImage)}
            variant="tonal"
          >
            <Search aria-hidden="true" size={16} />
            Search bottles
          </ButtonLink>
          <Button fullWidth onClick={onStartOver} variant="tonal">
            <RotateCcw aria-hidden="true" size={16} />
            Start over
          </Button>
        </FormGrid>
        {selection.photoTrace && (
          <PhotoIdentificationTraceFootnote
            traceId={selection.photoTrace.traceId}
            copyPayload={selection.photoTrace.copyPayload}
          />
        )}
      </FormStack>
    </WorkflowScreen>
  );
}

function AddedToLibrary({
  entry,
  userLibraryHref,
  photoTrace,
  onAddAnother,
  onStatusChange,
  statusError,
  updatingStatus = false,
}: {
  entry: CollectionBottle;
  userLibraryHref: string;
  photoTrace?: FlowBottle["photoTrace"] | null;
  onAddAnother: () => void;
  onStatusChange: (status: NonNullable<CollectionBottleStatusValue>) => void;
  statusError?: string;
  updatingStatus?: boolean;
}) {
  return (
    <WorkflowScreen title="Add to your Library">
      <FormStack>
        <FormSection
          description="This bottle is now saved in your Library."
          title="Added to Library"
        >
          <FormStack>
            <CollectionBottlePanel entry={entry} />
            {statusError ? <FormNotice>{statusError}</FormNotice> : null}
            <CollectionBottleStatusChips
              disabled={updatingStatus}
              onChange={onStatusChange}
              value={entry.status ?? null}
            />
          </FormStack>
        </FormSection>
        <FormGrid>
          <ButtonLink
            variant="accent"
            href={`/bottles/${entry.bottle.id}/addTasting`}
            fullWidth
          >
            <Wine aria-hidden="true" size={16} />
            Log a tasting
          </ButtonLink>
          <ButtonLink
            href={getViewBottleHref(entry.bottle)}
            fullWidth
            variant="tonal"
          >
            <Eye aria-hidden="true" size={16} />
            View bottle
          </ButtonLink>
          <Button fullWidth onClick={onAddAnother} variant="tonal">
            <Plus aria-hidden="true" size={16} />
            Add another to Library
          </Button>
          <ButtonLink fullWidth href={userLibraryHref} variant="tonal">
            <BookOpen aria-hidden="true" size={16} />
            View Library
          </ButtonLink>
        </FormGrid>
        {photoTrace ? (
          <PhotoIdentificationTraceFootnote
            copyPayload={photoTrace.copyPayload}
            traceId={photoTrace.traceId}
          />
        ) : null}
      </FormStack>
    </WorkflowScreen>
  );
}

function AddBottleFlowContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { flash } = useFlashMessages();
  const intent = getIntent(searchParams.get("intent"));
  const flowTitle = getFlowTitle(intent);
  const requestedBottleId = parseId(searchParams.get("bottle"));
  const requestedResultSource =
    searchParams.get("resultSource") === "created" ? "created" : undefined;
  const requestedFlightId = searchParams.get("flight") || null;
  const requestedPendingImage = useMemo(
    () => getPendingImageFromParams(new URLSearchParams(searchParams)),
    [searchParams],
  );
  const requestedBottleKey = useMemo(() => {
    const pendingImageKey = requestedPendingImage?.id ?? "no-image";
    if (requestedBottleId) {
      return `bottle:${requestedBottleId}:${pendingImageKey}:${requestedResultSource ?? "found"}:${intent}`;
    }
    return null;
  }, [
    intent,
    requestedBottleId,
    requestedPendingImage?.id,
    requestedResultSource,
  ]);

  const [handledBottleKey, setHandledBottleKey] = useState<string | null>(null);
  const [bottleLoadError, setBottleLoadError] = useState<string | null>(null);
  const [selectedBottle, setSelectedBottle] = useState<FlowBottle | null>(null);
  const [libraryError, setLibraryError] = useState<string | undefined>();
  const [addedEntry, setAddedEntry] = useState<CollectionBottle | null>(null);
  const [addedEntryPhotoTrace, setAddedEntryPhotoTrace] = useState<
    FlowBottle["photoTrace"] | null
  >(null);
  const [tastingDraft, setTastingDraft] = useState<TastingDraft | null>(null);
  const [tastingLoadError, setTastingLoadError] = useState<
    string | undefined
  >();
  const [loadingTastingDraft, setLoadingTastingDraft] = useState(false);
  const userLibraryHref = user ? `/users/${user.username}/library` : "/library";
  const inlineBottleHref = useCallback(
    (bottle: { id: number }) =>
      getAddBottleHref({
        bottleId: bottle.id,
        intent: getCreateReturnAction(intent),
      }),
    [intent],
  );
  const inlineCreateBottleHref = useCallback(
    (query: string) =>
      getCreateBottleHref({
        query,
        returnAction: getCreateReturnAction(intent),
      }),
    [intent],
  );

  const libraryCreateMutation = useMutation(
    orpc.collections.bottles.create.mutationOptions(),
  );
  const libraryStatusUpdateMutation = useMutation(
    orpc.collections.bottles.update.mutationOptions(),
  );
  const tastingCreateMutation = useMutation(
    orpc.tastings.create.mutationOptions(),
  );
  const memberReviewSaveMutation = useMutation(
    orpc.memberReviews.save.mutationOptions(),
  );
  const memberReviewImageUpdateMutation = useMutation(
    orpc.memberReviews.imageUpdate.mutationOptions(),
  );
  const memberReviewImageDeleteMutation = useMutation(
    orpc.memberReviews.imageDelete.mutationOptions(),
  );
  const tastingImageUpdateMutation = useMutation(
    orpc.tastings.imageUpdate.mutationOptions(),
  );

  useEffect(() => {
    return () => {
      if (selectedBottle?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(selectedBottle.previewUrl);
      }
    };
  }, [selectedBottle?.previewUrl]);

  useEffect(() => {
    if (!requestedBottleKey || !requestedBottleId) {
      setHandledBottleKey(null);
      return;
    }

    const bottleId = requestedBottleId;
    let cancelled = false;

    async function loadRequestedBottle() {
      setBottleLoadError(null);
      setAddedEntry(null);
      setAddedEntryPhotoTrace(null);
      setTastingDraft(null);
      setTastingLoadError(undefined);

      try {
        const bottle = await orpc.bottles.details.call({
          bottle: bottleId,
        });
        const collectionStatus = await orpc.collections.bottles.list.call({
          user: "me",
          collection: "library",
          bottle: bottle.id,
        });

        if (cancelled) return;
        const libraryEntry = collectionStatus.results[0] ?? null;
        const selection: FlowBottle = {
          bottle,
          hasLibraryEntry: Boolean(libraryEntry),
          libraryEntryImageUrl: libraryEntry?.imageUrl ?? null,
          pendingImage: requestedPendingImage,
          previewUrl: requestedPendingImage?.imageUrl || null,
          resultSource: requestedResultSource,
        };

        if (intent === "tasting") {
          try {
            const suggestedTags = await orpc.bottles.suggestedTags.call({
              bottle: selection.bottle.id,
            });
            if (cancelled) return;
            setSelectedBottle(null);
            setTastingDraft({
              ...selection,
              suggestedTags,
              createdAt: new Date().toISOString(),
            });
          } catch (err) {
            logError(err);
            if (cancelled) return;
            setSelectedBottle(selection);
            setTastingLoadError(
              "We couldn't load the tasting form. Try again or search for the bottle.",
            );
          }
        } else {
          setSelectedBottle(selection);
        }
        setHandledBottleKey(requestedBottleKey);
      } catch (err) {
        logError(err);
        if (cancelled) return;
        setSelectedBottle(null);
        setHandledBottleKey(requestedBottleKey);
        setBottleLoadError(
          "We couldn't load that bottle. Search again or start over.",
        );
      }
    }

    if (handledBottleKey !== requestedBottleKey) {
      void loadRequestedBottle();
    }

    return () => {
      cancelled = true;
    };
  }, [
    intent,
    handledBottleKey,
    orpc,
    requestedBottleId,
    requestedPendingImage,
    requestedBottleKey,
    requestedResultSource,
  ]);

  function resetFlow(nextIntent: AddBottleIntent) {
    setSelectedBottle(null);
    setLibraryError(undefined);
    setAddedEntry(null);
    setAddedEntryPhotoTrace(null);
    setTastingDraft(null);
    setTastingLoadError(undefined);
    setBottleLoadError(null);
    setHandledBottleKey(requestedBottleKey);
    router.replace(getAddBottleHref({ intent: nextIntent }));
  }

  function startOver() {
    resetFlow(intent);
  }

  function addAnotherToLibrary() {
    resetFlow("library");
  }

  async function startLogTasting(selection: FlowBottle) {
    setTastingLoadError(undefined);
    setLoadingTastingDraft(true);
    try {
      const suggestedTags = await orpc.bottles.suggestedTags.call({
        bottle: selection.bottle.id,
      });
      setLibraryError(undefined);
      setTastingDraft({
        ...selection,
        suggestedTags,
        createdAt: new Date().toISOString(),
      });
      revokeBlobPreviewUrl(selection);
    } catch (err) {
      logError(err);
      setSelectedBottle(selection);
      setTastingLoadError(
        "We couldn't load the tasting form. Try again or search for the bottle.",
      );
    } finally {
      setLoadingTastingDraft(false);
    }
  }

  async function handleResolvedBottle(
    selection: FlowBottle,
    action?: BottleResolverAction,
  ) {
    setLibraryError(undefined);
    setAddedEntry(null);
    setAddedEntryPhotoTrace(null);
    setTastingDraft(null);
    setTastingLoadError(undefined);

    if (action) {
      selection.warnings?.forEach((warning) => flash(warning, "error"));
    }

    if (action === "library") {
      await addToLibrary(selection, { showOutcomeWhileSaving: false });
    } else if (action === "tasting") {
      await startLogTasting(selection);
    } else if (action === "create") {
      router.push(getViewBottleHref(selection.bottle));
      revokeBlobPreviewUrl(selection);
    } else {
      setSelectedBottle(selection);
    }
  }

  async function addToLibrary(
    selection = selectedBottle,
    {
      showOutcomeWhileSaving = true,
    }: {
      showOutcomeWhileSaving?: boolean;
    } = {},
  ) {
    if (!selection) return;

    if (showOutcomeWhileSaving) {
      setSelectedBottle(selection);
    }
    setLibraryError(undefined);
    setTastingDraft(null);
    if (!canSaveBottleToLibrary(selection)) return;

    try {
      const entry = await libraryCreateMutation.mutateAsync({
        bottle: selection.bottle.id,
        user: "me",
        collection: "library",
        pendingImageId: selection.pendingImage?.id,
      });
      setAddedEntry(entry);
      setAddedEntryPhotoTrace(selection.photoTrace ?? null);
      setSelectedBottle(null);
      revokeBlobPreviewUrl(selection);
    } catch (err) {
      logError(err);
      setSelectedBottle(selection);
      setLibraryError(
        getFormErrorMessage(err, {
          expectedErrorNames: ["BAD_REQUEST", "CONFLICT"],
          fallbackMessage: "Could not save to Library.",
        }),
      );
    }
  }

  async function updateAddedEntryStatus(
    status: NonNullable<CollectionBottleStatusValue>,
  ) {
    if (!addedEntry) return;

    setLibraryError(undefined);
    try {
      const updatedEntry = await libraryStatusUpdateMutation.mutateAsync({
        user: "me",
        collection: "library",
        collectionBottle: addedEntry.id,
        status,
      });
      setAddedEntry(updatedEntry);
      await queryClient.invalidateQueries({
        queryKey: orpc.collections.bottles.list.key({
          input: {
            user: "me",
            collection: "library",
          },
        }),
      });
      if (user) {
        await queryClient.invalidateQueries({
          queryKey: orpc.collections.bottles.list.key({
            input: {
              user: user.username,
              collection: "library",
            },
          }),
        });
      }
      await queryClient.invalidateQueries({
        queryKey: orpc.collections.bottles.list.key({
          input: {
            user: "me",
            collection: "library",
            bottle: updatedEntry.bottle.id,
          },
        }),
      });
    } catch (err) {
      logError(err, { context: "add_bottle_library_status_update" });
      setLibraryError(
        getFormErrorMessage(err, {
          expectedErrorNames: ["BAD_REQUEST", "FORBIDDEN", "NOT_FOUND"],
          fallbackMessage: "Could not update Library status.",
        }),
      );
    }
  }

  async function submitTasting({ image, ...data }: TastingSubmitData) {
    if (!tastingDraft) return;

    const pendingImageId =
      image === undefined ? tastingDraft.pendingImage?.id : undefined;

    const { tasting, awards } = await tastingCreateMutation.mutateAsync({
      ...data,
      flight: requestedFlightId,
      createdAt: tastingDraft.createdAt,
      pendingImageId,
    });

    if (!tasting) {
      throw new Error("Tasting was not returned after save.");
    }

    if (image) {
      try {
        await uploadImageAfterSave({
          prepare: async () =>
            image instanceof File ? image : await toBlob(image),
          upload: async (imageFile) => {
            await tastingImageUpdateMutation.mutateAsync({
              tasting: tasting.id,
              file: imageFile,
            });
          },
        });
      } catch (err) {
        logError(err, {
          context: "tasting_image_upload_after_create",
          extra: { tastingId: tasting.id },
        });
        flash(
          "We couldn't upload the picture, but your tasting was saved.",
          "error",
        );
      }
    }

    for (const award of awards) {
      if (award.level != award.prevLevel && award.level) {
        flash(
          <BadgeAwardMessage badge={award.badge} level={award.level} />,
          "info",
        );
      }
    }

    router.push(
      requestedFlightId
        ? `/flights/${requestedFlightId}`
        : `/tastings/${tasting.id}`,
    );
  }

  async function submitMemberReview({
    image,
    ...data
  }: MemberReviewFormSubmitData) {
    if (!tastingDraft) return;

    let review = await memberReviewSaveMutation.mutateAsync({
      ...data,
      pendingImageId:
        image === undefined ? tastingDraft.pendingImage?.id : undefined,
    });

    try {
      if (image) {
        await uploadImageAfterSave({
          prepare: async () =>
            image instanceof File ? image : await toBlob(image),
          upload: async (imageFile) => {
            review = await memberReviewImageUpdateMutation.mutateAsync({
              bottle: review.bottleId,
              file: imageFile,
            });
          },
        });
      } else if (image === null && review.imageUrl) {
        review = await memberReviewImageDeleteMutation.mutateAsync({
          bottle: review.bottleId,
        });
      }
    } catch (err) {
      logError(err, {
        context: "member_review_image_update_after_save",
        extra: { memberReviewId: review.id },
      });
      flash(
        "We couldn't update the picture, but your review was saved.",
        "error",
      );
    }

    queryClient.setQueryData(
      orpc.memberReviews.getMy.key({
        input: { bottle: review.bottleId },
        type: "query",
      }),
      review,
    );
    await queryClient.invalidateQueries({
      queryKey: orpc.bottles.details.key({
        input: { bottle: review.bottleId },
        type: "query",
      }),
    });

    flash("Review saved.", "info");
    router.push(`/reviews/${review.id}`);
  }

  if (requestedBottleKey && handledBottleKey !== requestedBottleKey) {
    return <LoadingBottlePanel intent={intent} title={flowTitle} />;
  }

  if (bottleLoadError) {
    return (
      <BottleLoadErrorPanel
        message={bottleLoadError}
        onStartOver={startOver}
        title={flowTitle}
      />
    );
  }

  if (addedEntry) {
    return (
      <AddedToLibrary
        entry={addedEntry}
        userLibraryHref={userLibraryHref}
        photoTrace={addedEntryPhotoTrace}
        onAddAnother={addAnotherToLibrary}
        onStatusChange={(status) => void updateAddedEntryStatus(status)}
        statusError={libraryError}
        updatingStatus={libraryStatusUpdateMutation.isPending}
      />
    );
  }

  if (tastingDraft) {
    return (
      <TastingForm
        title="Log a tasting"
        initialData={{
          bottle: tastingDraft.bottle,
          imageUrl: tastingDraft.pendingImage?.imageUrl,
        }}
        suggestedTags={tastingDraft.suggestedTags}
        onReviewSubmit={submitMemberReview}
        onSubmit={submitTasting}
      />
    );
  }

  if (selectedBottle) {
    return (
      <OutcomeSelection
        selection={selectedBottle}
        intent={intent}
        error={libraryError ?? tastingLoadError}
        onAddToLibrary={() => {
          setLibraryError(undefined);
          setTastingDraft(null);
          setTastingLoadError(undefined);
          void addToLibrary(selectedBottle);
        }}
        onLogTasting={() => void startLogTasting(selectedBottle)}
        onStartOver={startOver}
        addingToLibrary={libraryCreateMutation.isPending}
        loggingTasting={loadingTastingDraft}
      />
    );
  }

  return (
    <BottleResolver
      title={flowTitle}
      search={
        <BottleSearch
          getBottleHref={inlineBottleHref}
          getContributionHref={inlineCreateBottleHref}
          initialScope="bottles"
          placement="page"
          placeholder="Search by bottle, brand, or distiller…"
          scopeValues={["bottles"]}
          showBottleRatings={false}
        />
      }
      searchHrefForQuery={(query, pendingImage) =>
        getSearchHref(query, intent, pendingImage)
      }
      createBottleHrefForResult={(
        query: string,
        prefill?: CreateBottlePrefill,
        pendingImage?: PendingImageRef | null,
      ) =>
        getCreateBottleHref({
          query,
          returnAction: getCreateReturnAction(intent),
          prefill,
          pendingImage,
        })
      }
      createProposalActionLabel="Add a bottle"
      searchActionLabel="Search bottles"
      renderMatchedResultActions={(props) => (
        <MatchedOutcomeActions {...props} intent={intent} />
      )}
      renderCreateProposalActions={(props) => (
        <CreateProposalOutcomeActions {...props} intent={intent} />
      )}
      onResolve={handleResolvedBottle}
    />
  );
}

/**
 * Owns the standalone Bottle flow route: auth-gated resolution, direct
 * Bottle and legacy-release query parameters, direct Library saves, and tasting continuation
 * stay in this flow so scan image reuse remains attached to the user's action.
 */
export default function AddBottleFlow() {
  return (
    <AuthRequired>
      <AddBottleFlowContent />
    </AuthRequired>
  );
}
