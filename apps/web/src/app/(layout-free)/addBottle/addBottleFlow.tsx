"use client";

import type { Outputs } from "@peated/server/orpc/router";
import {
  Button,
  ButtonLink,
  CollectionBottleStatusInput,
  FieldGroup,
  FormGrid,
  FormNotice,
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
import { WorkflowScreen } from "@peated/web/components/workflowScreen.stylex";
import TastingForm, {
  TastingFormLoading,
  type MemberReviewFormSubmitData,
  type TastingCreateFormSubmitData,
} from "@peated/web/features/tastings/tastingForm";
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
import { getBottleUrl, getTastingUrl } from "@peated/web/lib/urls";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Eye, Plus, RotateCcw, Search, Wine } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeAwardMessage } from "./badgeAwardMessage.stylex";

type AddBottleIntent = "catalog" | "choose" | "library" | "tasting" | "view";
type CollectionBottle = Outputs["collections"]["bottles"]["create"];
type RatingDraft = BottleResolverResult & {
  suggestedTags: { results: TastingTagSuggestion[] };
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

function getFlowTitle(intent: AddBottleIntent) {
  if (intent === "catalog") return "Add a bottle";
  if (intent === "library") return "Add to your Library";
  if (intent === "tasting") return "Rate this bottle";
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

function canSaveBottleToLibrary(selection: BottleResolverResult) {
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

function BottleLoadingScreen({
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

function revokeBlobPreviewUrl(selection: BottleResolverResult) {
  if (selection.previewUrl?.startsWith("blob:")) {
    URL.revokeObjectURL(selection.previewUrl);
  }
}

function BottleLoadErrorScreen({
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
        <FormNotice role="alert">{message}</FormNotice>
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

function BottleResultActions({
  bottle,
  hasLibraryEntry,
  libraryEntryImageUrl,
  pendingImage,
  loadingExactLibraryStatus,
  resolvingAction,
  intent,
  changeBottleHref,
  onResolve,
}: BottleResolverMatchedActionsProps & {
  intent: AddBottleIntent;
  changeBottleHref?: string;
}) {
  const canSaveLibraryPhoto = Boolean(
    pendingImage && hasLibraryEntry && libraryEntryImageUrl === null,
  );
  const primaryAction =
    intent === "catalog" || intent === "view"
      ? "view"
      : intent === "library" && (!hasLibraryEntry || canSaveLibraryPhoto)
        ? "library"
        : "tasting";
  const libraryButton = (
    <Button
      fullWidth
      key="library"
      onClick={() => onResolve("library")}
      variant={primaryAction === "library" ? "accent" : "tonal"}
      disabled={
        Boolean(resolvingAction) ||
        loadingExactLibraryStatus ||
        (hasLibraryEntry && !canSaveLibraryPhoto)
      }
      loading={resolvingAction === "library" || loadingExactLibraryStatus}
    >
      <BookOpen aria-hidden="true" size={16} />
      {getLibraryActionLabel({ hasLibraryEntry, canSaveLibraryPhoto })}
    </Button>
  );
  const tastingButton = (
    <Button
      fullWidth
      key="tasting"
      onClick={() => onResolve("tasting")}
      variant={primaryAction === "tasting" ? "accent" : "tonal"}
      disabled={Boolean(resolvingAction)}
      loading={resolvingAction === "tasting"}
    >
      <Wine aria-hidden="true" size={16} />
      Rate this bottle
    </Button>
  );
  const viewButton = (
    <ButtonLink
      fullWidth
      key="view"
      href={getBottleUrl(bottle)}
      variant={primaryAction === "view" ? "accent" : "tonal"}
    >
      <Eye aria-hidden="true" size={16} />
      View bottle
    </ButtonLink>
  );
  const mainActions =
    primaryAction === "library"
      ? [libraryButton, tastingButton]
      : [tastingButton, libraryButton];

  return (
    <FormStack>
      {primaryAction === "view" ? viewButton : null}
      {mainActions}
      {changeBottleHref ? (
        <FormGrid>
          {primaryAction !== "view" ? viewButton : null}
          <ButtonLink fullWidth href={changeBottleHref} variant="tonal">
            <Search aria-hidden="true" size={16} />
            Change bottle
          </ButtonLink>
        </FormGrid>
      ) : primaryAction !== "view" ? (
        viewButton
      ) : null}
    </FormStack>
  );
}

function BottleCreationActions({
  createPending,
  resolvingAction,
  intent,
  onResolve,
}: BottleResolverCreateProposalActionsProps & { intent: AddBottleIntent }) {
  const creating = createPending || Boolean(resolvingAction);
  const primaryAction =
    intent === "catalog" || intent === "view"
      ? "create"
      : intent === "library"
        ? "library"
        : "tasting";
  const libraryButton = (
    <Button
      fullWidth
      key="library"
      onClick={() => onResolve("library")}
      variant={primaryAction === "library" ? "accent" : "tonal"}
      disabled={creating}
      loading={resolvingAction === "library"}
    >
      <BookOpen aria-hidden="true" size={16} />
      Add to Library
    </Button>
  );
  const tastingButton = (
    <Button
      fullWidth
      key="tasting"
      onClick={() => onResolve("tasting")}
      variant={primaryAction === "tasting" ? "accent" : "tonal"}
      disabled={creating}
      loading={resolvingAction === "tasting"}
    >
      <Wine aria-hidden="true" size={16} />
      Rate this bottle
    </Button>
  );
  const createButton = (
    <Button
      fullWidth
      key="create"
      onClick={() => onResolve("create")}
      variant={primaryAction === "create" ? "accent" : "tonal"}
      disabled={creating}
      loading={resolvingAction === "create"}
    >
      <Plus aria-hidden="true" size={16} />
      Add a bottle
    </Button>
  );
  const actionButtons =
    primaryAction === "tasting"
      ? [tastingButton, libraryButton, createButton]
      : primaryAction === "create"
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

function BottleResultScreen({
  selection,
  intent,
  onAddToLibrary,
  onRateBottle,
  onStartOver,
  addingToLibrary,
  loadingRatingForm,
  error,
}: {
  selection: BottleResolverResult;
  intent: AddBottleIntent;
  onAddToLibrary: () => void;
  onRateBottle: () => void;
  onStartOver: () => void;
  addingToLibrary: boolean;
  loadingRatingForm: boolean;
  error?: string;
}) {
  return (
    <WorkflowScreen
      onClose={onStartOver}
      title={
        selection.resultSource === "created"
          ? "Bottle added"
          : getFlowTitle(intent)
      }
    >
      <FormStack>
        <SelectedBottleSummary
          bottle={selection.bottle}
          imageUrl={selection.previewUrl ?? selection.bottle.imageUrl}
        />
        {selection.warnings?.length ? (
          <FormNotice>{selection.warnings.join(" ")}</FormNotice>
        ) : null}
        {error ? <FormNotice role="alert">{error}</FormNotice> : null}
        <BottleResultActions
          {...selection}
          intent={intent}
          changeBottleHref={getSearchHref("", intent, selection.pendingImage)}
          loadingExactLibraryStatus={false}
          resolvingAction={
            addingToLibrary ? "library" : loadingRatingForm ? "tasting" : null
          }
          onResolve={(action) =>
            action === "library" ? onAddToLibrary() : onRateBottle()
          }
        />
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
  photoTrace,
  onFindAnother,
  onStatusChange,
  statusError,
  updatingStatus = false,
}: {
  entry: CollectionBottle;
  photoTrace?: BottleResolverResult["photoTrace"] | null;
  onFindAnother: () => void;
  onStatusChange: (status: NonNullable<CollectionBottleStatusValue>) => void;
  statusError?: string;
  updatingStatus?: boolean;
}) {
  return (
    <WorkflowScreen title="Added to Library">
      <FormStack>
        <SelectedBottleSummary
          bottle={entry.bottle}
          imageUrl={entry.imageUrl ?? entry.bottle.imageUrl}
        />
        <FieldGroup label="Bottle status" optional>
          <CollectionBottleStatusInput
            disabled={updatingStatus}
            onChange={onStatusChange}
            value={entry.status ?? null}
          />
          {statusError ? (
            <FormNotice role="alert">{statusError}</FormNotice>
          ) : null}
        </FieldGroup>
        <ButtonLink
          variant="accent"
          href={getAddBottleHref({
            bottleId: entry.bottle.id,
            intent: "tasting",
          })}
          fullWidth
        >
          <Wine aria-hidden="true" size={16} />
          Rate this bottle
        </ButtonLink>
        <ButtonLink fullWidth href={getBottleUrl(entry.bottle)} variant="tonal">
          <Eye aria-hidden="true" size={16} />
          View this bottle
        </ButtonLink>
        <Button
          fullWidth
          onClick={onFindAnother}
          variant="tonal"
          disabled={updatingStatus}
        >
          <Search aria-hidden="true" size={16} />
          Find another bottle
        </Button>
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
  const [selectedBottle, setSelectedBottle] =
    useState<BottleResolverResult | null>(null);
  const [libraryError, setLibraryError] = useState<string | undefined>();
  const [addedEntry, setAddedEntry] = useState<CollectionBottle | null>(null);
  const [addedEntryPhotoTrace, setAddedEntryPhotoTrace] = useState<
    BottleResolverResult["photoTrace"] | null
  >(null);
  const [ratingDraft, setRatingDraft] = useState<RatingDraft | null>(null);
  const [ratingLoadError, setRatingLoadError] = useState<string | undefined>();
  const [loadingRatingDraft, setLoadingRatingDraft] = useState(false);
  const inlineBottleHref = useCallback(
    (bottle: { id: number }) =>
      getAddBottleHref({
        bottleId: bottle.id,
        intent,
      }),
    [intent],
  );
  const inlineCreateBottleHref = useCallback(
    (query: string) =>
      getCreateBottleHref({
        query,
        returnAction: intent,
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
      setRatingDraft(null);
      setRatingLoadError(undefined);

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
        const selection: BottleResolverResult = {
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
            setRatingDraft({
              ...selection,
              suggestedTags,
              createdAt: new Date().toISOString(),
            });
          } catch (err) {
            logError(err);
            if (cancelled) return;
            setSelectedBottle(selection);
            setRatingLoadError(
              "We couldn't load the form. Try again or search for the bottle.",
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
    setRatingDraft(null);
    setRatingLoadError(undefined);
    setBottleLoadError(null);
    setHandledBottleKey(requestedBottleKey);
    router.replace(getAddBottleHref({ intent: nextIntent }));
  }

  function startOver() {
    resetFlow(intent);
  }

  function findAnotherBottle() {
    resetFlow("choose");
  }

  async function openRatingForm(selection: BottleResolverResult) {
    setRatingLoadError(undefined);
    setLoadingRatingDraft(true);
    try {
      const suggestedTags = await orpc.bottles.suggestedTags.call({
        bottle: selection.bottle.id,
      });
      setLibraryError(undefined);
      setRatingDraft({
        ...selection,
        suggestedTags,
        createdAt: new Date().toISOString(),
      });
      revokeBlobPreviewUrl(selection);
    } catch (err) {
      setSelectedBottle(selection);
      setRatingLoadError(
        getFormErrorMessage(err, {
          fallbackMessage:
            "We couldn't load the form. Try again or search for the bottle.",
        }),
      );
    } finally {
      setLoadingRatingDraft(false);
    }
  }

  async function handleResolvedBottle(
    selection: BottleResolverResult,
    action?: BottleResolverAction,
  ) {
    setLibraryError(undefined);
    setAddedEntry(null);
    setAddedEntryPhotoTrace(null);
    setRatingDraft(null);
    setRatingLoadError(undefined);

    if (action) {
      selection.warnings?.forEach((warning) => flash(warning, "error"));
    }

    if (action === "library") {
      await addToLibrary(selection, { showResultWhileSaving: false });
    } else if (action === "tasting") {
      await openRatingForm(selection);
    } else if (action === "create") {
      router.push(getBottleUrl(selection.bottle));
      revokeBlobPreviewUrl(selection);
    } else {
      setSelectedBottle(selection);
    }
  }

  async function addToLibrary(
    selection = selectedBottle,
    {
      showResultWhileSaving = true,
    }: {
      showResultWhileSaving?: boolean;
    } = {},
  ) {
    if (!selection) return;

    if (showResultWhileSaving) {
      setSelectedBottle(selection);
    }
    setLibraryError(undefined);
    setRatingDraft(null);
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
      setLibraryError(
        getFormErrorMessage(err, {
          expectedErrorNames: ["BAD_REQUEST", "FORBIDDEN", "NOT_FOUND"],
          fallbackMessage: "Could not update Library status.",
        }),
      );
    }
  }

  async function submitTasting({
    image,
    ...data
  }: TastingCreateFormSubmitData) {
    if (!ratingDraft) return;

    const pendingImageId =
      image === undefined ? ratingDraft.pendingImage?.id : undefined;

    const { tasting, awards } = await tastingCreateMutation.mutateAsync({
      ...data,
      flight: requestedFlightId,
      createdAt: ratingDraft.createdAt,
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
        : getTastingUrl(tasting),
    );
  }

  async function submitMemberReview({
    image,
    ...data
  }: MemberReviewFormSubmitData) {
    if (!ratingDraft) return;

    let review = await memberReviewSaveMutation.mutateAsync({
      ...data,
      pendingImageId:
        image === undefined ? ratingDraft.pendingImage?.id : undefined,
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
    return <BottleLoadingScreen intent={intent} title={flowTitle} />;
  }

  if (bottleLoadError) {
    return (
      <BottleLoadErrorScreen
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
        photoTrace={addedEntryPhotoTrace}
        onFindAnother={findAnotherBottle}
        onStatusChange={(status) => void updateAddedEntryStatus(status)}
        statusError={libraryError}
        updatingStatus={libraryStatusUpdateMutation.isPending}
      />
    );
  }

  if (ratingDraft) {
    return (
      <TastingForm
        title="Rate this bottle"
        initialData={{
          bottle: ratingDraft.bottle,
          imageUrl: ratingDraft.pendingImage?.imageUrl,
        }}
        suggestedTags={ratingDraft.suggestedTags}
        onReviewSubmit={submitMemberReview}
        onSubmit={submitTasting}
      />
    );
  }

  if (selectedBottle) {
    return (
      <BottleResultScreen
        selection={selectedBottle}
        intent={intent}
        error={libraryError ?? ratingLoadError}
        onAddToLibrary={() => {
          setLibraryError(undefined);
          setRatingDraft(null);
          setRatingLoadError(undefined);
          void addToLibrary(selectedBottle);
        }}
        onRateBottle={() => void openRatingForm(selectedBottle)}
        onStartOver={startOver}
        addingToLibrary={libraryCreateMutation.isPending}
        loadingRatingForm={loadingRatingDraft}
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
          returnAction: intent,
          prefill,
          pendingImage,
        })
      }
      createProposalActionLabel="Add a bottle"
      searchActionLabel="Search bottles"
      renderMatchedResultActions={(props) => (
        <BottleResultActions {...props} intent={intent} />
      )}
      renderCreateProposalActions={(props) => (
        <BottleCreationActions {...props} intent={intent} />
      )}
      onResolve={handleResolvedBottle}
    />
  );
}

/**
 * Keeps bottle lookup, Library saves, tastings, and reviews together so a
 * pending photo follows the selected action.
 */
export default function AddBottleFlow() {
  return (
    <AuthRequired>
      <AddBottleFlowContent />
    </AuthRequired>
  );
}
