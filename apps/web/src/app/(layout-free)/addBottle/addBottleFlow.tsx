"use client";

import type { Outputs } from "@peated/server/orpc/router";
import type { Bottle } from "@peated/server/types";
import BadgeImage from "@peated/web/components/badgeImage";
import BottleResolver, {
  type BottleResolverAction,
  type BottleResolverCreateProposalActionsProps,
  type BottleResolverMatchedActionsProps,
  type BottleResolverResult,
  type PendingImageRef,
} from "@peated/web/components/bottleResolver";
import { PhotoIdentificationTraceFootnote } from "@peated/web/components/bottleResolver/panels";
import Button from "@peated/web/components/button";
import { useFlashMessages } from "@peated/web/components/flash";
import FormError from "@peated/web/components/formError";
import Header from "@peated/web/components/header";
import Layout from "@peated/web/components/layout";
import {
  CollectionBottleStatusChips,
  type CollectionBottleStatusValue,
} from "@peated/web/components/libraryBottleStatus";
import Link from "@peated/web/components/link";
import type { CreateBottlePrefill } from "@peated/web/components/search/createBottleHref";
import { getCreateBottleHref } from "@peated/web/components/search/createBottleHref";
import Spinner from "@peated/web/components/spinner";
import TastingForm, {
  type TastingCreateFormSubmitData,
} from "@peated/web/components/tastingForm";
import useAuth from "@peated/web/hooks/useAuth";
import { AuthRequired } from "@peated/web/hooks/useAuthRequired";
import {
  getAddSimilarBottlePath,
  getPendingImageFromParams,
} from "@peated/web/lib/addBottle";
import { toBlob } from "@peated/web/lib/blobs";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import type { TastingTagSuggestion } from "@peated/web/lib/tastingForm";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpen,
  Check,
  Eye,
  Plus,
  RotateCcw,
  Search,
  Wine,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";

type AddBottleIntent = "choose" | "library" | "tasting" | "view";
type CollectionBottle = Outputs["collections"]["bottles"]["create"];
type FlowBottle = BottleResolverResult;
type SuggestedTags = { results: TastingTagSuggestion[] };
type TastingSubmitData = TastingCreateFormSubmitData;
type TastingDraft = FlowBottle & {
  suggestedTags: SuggestedTags;
  createdAt: string;
};

function getIntent(value: string | null): AddBottleIntent {
  if (value === "library" || value === "tasting" || value === "view") {
    return value;
  }
  return "choose";
}

function getCreateReturnAction(intent: AddBottleIntent) {
  return intent === "choose" ? "addBottle" : intent;
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
    intent: intent === "choose" ? "addBottle" : intent,
  });
  if (query) params.set("q", query);
  if (pendingImage?.id) params.set("pendingImageId", pendingImage.id);
  if (pendingImage?.imageUrl) {
    params.set("pendingImageUrl", pendingImage.imageUrl);
  }
  return `/search?${params.toString()}`;
}

function getViewBottleHref(bottle: Bottle) {
  return `/bottles/${bottle.id}`;
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
  return state.canSaveLibraryPhoto ? "Save Photo" : "In Library";
}

function FlowHeader({ children }: { children: ReactNode }) {
  return (
    <Header>
      <div className="flex w-full items-center gap-3">
        <h1 className="text-2xl font-bold">Add Bottle</h1>
      </div>
      {children}
    </Header>
  );
}

function BottlePanel({
  bottle,
  previewUrl,
}: {
  bottle: Bottle;
  previewUrl?: string | null;
}) {
  return (
    <section className="rounded border border-slate-800 bg-slate-950/50 p-4 lg:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Selected bottle label"
            className="h-24 w-24 shrink-0 rounded object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <Link
            href={getViewBottleHref(bottle)}
            className="font-semibold text-white hover:underline"
          >
            {bottle.fullName}
          </Link>
        </div>
      </div>
    </section>
  );
}

function CollectionBottlePanel({ entry }: { entry: CollectionBottle }) {
  return (
    <section className="rounded border border-slate-800 bg-slate-950/50 p-4 lg:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {entry.imageUrl && (
          <img
            src={entry.imageUrl}
            alt="Selected bottle label"
            className="h-24 w-24 shrink-0 rounded object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <Link
            href={getViewBottleHref(entry.bottle)}
            className="font-semibold text-white hover:underline"
          >
            {entry.bottle.fullName}
          </Link>
        </div>
      </div>
    </section>
  );
}

function LoadingBottlePanel() {
  return (
    <Layout footer={null} header={<FlowHeader>{null}</FlowHeader>}>
      <div className="mx-auto mt-5 max-w-3xl">
        <Spinner />
      </div>
    </Layout>
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
}: {
  message: string;
  onStartOver: () => void;
}) {
  return (
    <Layout footer={null} header={<FlowHeader>{null}</FlowHeader>}>
      <div className="mx-auto mt-5 max-w-3xl space-y-5">
        <FormError values={[message]} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            href={getSearchHref()}
            fullWidth
            icon={<Search className="h-4 w-4" />}
          >
            Search Bottles
          </Button>
          <Button
            fullWidth
            onClick={onStartOver}
            icon={<RotateCcw className="h-4 w-4" />}
          >
            Start Over
          </Button>
        </div>
      </div>
    </Layout>
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
      <Button
        href={href}
        color={emphasized ? "highlight" : "default"}
        fullWidth
        icon={icon}
      >
        {children}
      </Button>
    );
  }

  return (
    <Button
      onClick={onClick}
      color={emphasized ? "highlight" : "default"}
      fullWidth
      icon={icon}
      disabled={disabled}
      loading={loading}
    >
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
  const libraryButton = (
    <OutcomeButton
      key="library"
      onClick={() => onResolve("library")}
      icon={<BookOpen className="h-4 w-4" />}
      emphasized
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
      icon={<Wine className="h-4 w-4" />}
      emphasized
      disabled={Boolean(resolvingAction)}
      loading={resolvingAction === "tasting"}
    >
      Log Tasting
    </OutcomeButton>
  );
  const viewButton = (
    <OutcomeButton
      key="view"
      href={getViewBottleHref(bottle)}
      icon={<Eye className="h-4 w-4" />}
    >
      View Bottle
    </OutcomeButton>
  );
  const addSimilarBottleButton = (
    <OutcomeButton
      key="similar-bottle"
      href={getAddSimilarBottlePath(bottle.id)}
      icon={<Plus className="h-4 w-4" />}
    >
      Add a similar bottle
    </OutcomeButton>
  );
  const actionButtons =
    intent === "tasting"
      ? [
          tastingButton,
          libraryButton,
          viewButton,
          addSimilarBottleButton,
        ].filter(Boolean)
      : [
          libraryButton,
          tastingButton,
          viewButton,
          addSimilarBottleButton,
        ].filter(Boolean);

  return <div className="grid gap-3 sm:grid-cols-4">{actionButtons}</div>;
}

function CreateProposalOutcomeActions({
  createPending,
  resolvingAction,
  intent,
  onResolve,
}: BottleResolverCreateProposalActionsProps & { intent: AddBottleIntent }) {
  const creating = createPending || Boolean(resolvingAction);
  const libraryButton = (
    <OutcomeButton
      key="library"
      onClick={() => onResolve("library")}
      icon={<BookOpen className="h-4 w-4" />}
      emphasized
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
      icon={<Wine className="h-4 w-4" />}
      emphasized
      disabled={creating}
      loading={resolvingAction === "tasting"}
    >
      Log Tasting
    </OutcomeButton>
  );
  const createButton = (
    <OutcomeButton
      key="create"
      onClick={() => onResolve("create")}
      icon={<Plus className="h-4 w-4" />}
      disabled={creating}
      loading={resolvingAction === "create"}
    >
      Create Bottle
    </OutcomeButton>
  );
  const actionButtons =
    intent === "tasting"
      ? [tastingButton, libraryButton, createButton]
      : intent === "view"
        ? [createButton, libraryButton, tastingButton]
        : [libraryButton, tastingButton, createButton];

  return <div className="grid gap-3 sm:grid-cols-3">{actionButtons}</div>;
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
  const title = wasCreated ? "Bottle created" : "Bottle found";
  const description = wasCreated
    ? "Choose what you want to do next."
    : "Choose what you want to do with this bottle.";
  const libraryButton = (
    <OutcomeButton
      key="library"
      onClick={onAddToLibrary}
      icon={<BookOpen className="h-4 w-4" />}
      emphasized
      disabled={
        !canSaveBottleToLibrary(selection) || addingToLibrary || loggingTasting
      }
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
      icon={<Wine className="h-4 w-4" />}
      emphasized
      disabled={loggingTasting}
      loading={loggingTasting}
    >
      Log Tasting
    </OutcomeButton>
  );
  const viewButton = (
    <OutcomeButton
      key="view"
      href={getViewBottleHref(selection.bottle)}
      icon={<Eye className="h-4 w-4" />}
    >
      View Bottle
    </OutcomeButton>
  );
  const addSimilarBottleButton = (
    <OutcomeButton
      key="similar-bottle"
      href={getAddSimilarBottlePath(selection.bottle.id)}
      icon={<Plus className="h-4 w-4" />}
    >
      Add a similar bottle
    </OutcomeButton>
  );
  const actionButtons =
    intent === "tasting"
      ? [
          tastingButton,
          libraryButton,
          viewButton,
          addSimilarBottleButton,
        ].filter(Boolean)
      : [
          libraryButton,
          tastingButton,
          viewButton,
          addSimilarBottleButton,
        ].filter(Boolean);

  return (
    <Layout footer={null} header={<FlowHeader>{null}</FlowHeader>}>
      <div className="mx-auto mt-5 max-w-3xl space-y-5">
        <BottlePanel
          bottle={selection.bottle}
          previewUrl={selection.previewUrl}
        />
        {selection.warnings?.length ? (
          <section className="rounded border border-amber-900/70 bg-amber-950/30 p-4 text-sm text-amber-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                {selection.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </div>
          </section>
        ) : null}
        {error && <FormError values={[error]} />}
        <section className="rounded border border-slate-800 bg-slate-950/50 p-4 lg:p-6">
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold text-white">{title}</h2>
              <p className="text-muted mt-1 text-sm">{description}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">{actionButtons}</div>
          </div>
        </section>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            href={getSearchHref("", intent, selection.pendingImage)}
            fullWidth
            icon={<Search className="h-4 w-4" />}
          >
            Search Bottles
          </Button>
          <Button
            fullWidth
            onClick={onStartOver}
            icon={<RotateCcw className="h-4 w-4" />}
          >
            Start Over
          </Button>
        </div>
        {selection.photoTrace && (
          <PhotoIdentificationTraceFootnote
            traceId={selection.photoTrace.traceId}
            copyPayload={selection.photoTrace.copyPayload}
          />
        )}
      </div>
    </Layout>
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
    <Layout footer={null} header={<FlowHeader>{null}</FlowHeader>}>
      <div className="mx-auto mt-5 max-w-3xl space-y-5">
        <section className="rounded border border-slate-800 bg-slate-950/50 p-4 lg:p-6">
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="bg-highlight rounded-full p-2 text-black">
                <Check className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-white">Added to Library</h2>
                <p className="text-muted mt-1 text-sm">
                  This bottle is now saved in your Library.
                </p>
              </div>
            </div>
            <CollectionBottlePanel entry={entry} />
            {statusError && <FormError values={[statusError]} />}
            <div className="border-t border-slate-800 pt-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Bottle status
                  </h3>
                </div>
                <CollectionBottleStatusChips
                  value={entry.status ?? null}
                  disabled={updatingStatus}
                  onChange={onStatusChange}
                />
              </div>
            </div>
          </div>
        </section>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            color="highlight"
            fullWidth
            icon={<Plus className="h-4 w-4" />}
            onClick={onAddAnother}
          >
            Add Another Bottle
          </Button>
          <Button
            href={userLibraryHref}
            fullWidth
            icon={<BookOpen className="h-4 w-4" />}
          >
            View Library
          </Button>
        </div>
        {photoTrace && (
          <PhotoIdentificationTraceFootnote
            traceId={photoTrace.traceId}
            copyPayload={photoTrace.copyPayload}
          />
        )}
      </div>
    </Layout>
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
  const requestedBottleId = parseId(searchParams.get("bottle"));
  const requestedReleaseId = parseId(
    searchParams.get("release") ?? searchParams.get("bottling"),
  );
  const requestedFlightId = searchParams.get("flight") || null;
  const requestedPendingImage = useMemo(
    () => getPendingImageFromParams(new URLSearchParams(searchParams)),
    [searchParams],
  );
  const requestedBottleKey = useMemo(() => {
    const pendingImageKey = requestedPendingImage?.id ?? "no-image";
    if (requestedReleaseId && !requestedBottleId) {
      return `unsupported-release:${requestedReleaseId}:${pendingImageKey}`;
    }
    if (requestedBottleId) {
      return `bottle:${requestedBottleId}:${requestedReleaseId ?? "base"}:${pendingImageKey}`;
    }
    return null;
  }, [requestedBottleId, requestedPendingImage?.id, requestedReleaseId]);

  const [loadedBottleKey, setLoadedBottleKey] = useState<string | null>(null);
  const [loadingBottle, setLoadingBottle] = useState(false);
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

  const libraryCreateMutation = useMutation(
    orpc.collections.bottles.create.mutationOptions(),
  );
  const libraryStatusUpdateMutation = useMutation(
    orpc.collections.bottles.update.mutationOptions(),
  );
  const tastingCreateMutation = useMutation(
    orpc.tastings.create.mutationOptions(),
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
    if (requestedReleaseId && !requestedBottleId) {
      setSelectedBottle(null);
      setLoadedBottleKey(requestedBottleKey);
      setLoadingBottle(false);
      setBottleLoadError(
        "This old release link is incomplete. Search for the exact bottle instead.",
      );
      return;
    }
    if (!requestedBottleKey || !requestedBottleId) {
      setLoadedBottleKey(null);
      return;
    }

    const bottleId = requestedBottleId;
    let cancelled = false;

    async function loadRequestedBottle() {
      setLoadingBottle(true);
      setBottleLoadError(null);
      setAddedEntry(null);
      setAddedEntryPhotoTrace(null);
      setTastingDraft(null);
      setTastingLoadError(undefined);

      try {
        const promotedBottleId = requestedReleaseId
          ? (
              await orpc.bottleReleases.bottle.call({
                bottle: bottleId,
                release: requestedReleaseId,
              })
            ).bottleId
          : bottleId;
        const bottle = await orpc.bottles.details.call({
          bottle: promotedBottleId,
        });
        const collectionStatus = await orpc.collections.bottles.list.call({
          user: "me",
          collection: "library",
          bottle: bottle.id,
        });

        if (cancelled) return;
        const libraryEntry = collectionStatus.results[0] ?? null;
        setSelectedBottle({
          bottle,
          hasLibraryEntry: Boolean(libraryEntry),
          libraryEntryImageUrl: libraryEntry?.imageUrl ?? null,
          pendingImage: requestedPendingImage,
          previewUrl: requestedPendingImage?.imageUrl || null,
        });
        setLoadedBottleKey(requestedBottleKey);
      } catch (err) {
        logError(err);
        if (cancelled) return;
        setSelectedBottle(null);
        setLoadedBottleKey(null);
        setBottleLoadError(
          "We couldn't load that bottle. Search again or start over.",
        );
      } finally {
        if (!cancelled) setLoadingBottle(false);
      }
    }

    if (loadedBottleKey !== requestedBottleKey) {
      void loadRequestedBottle();
    }

    return () => {
      cancelled = true;
    };
  }, [
    loadedBottleKey,
    orpc,
    requestedBottleId,
    requestedPendingImage,
    requestedReleaseId,
    requestedBottleKey,
  ]);

  function startOver() {
    setSelectedBottle(null);
    setLibraryError(undefined);
    setAddedEntry(null);
    setAddedEntryPhotoTrace(null);
    setTastingDraft(null);
    setTastingLoadError(undefined);
    setBottleLoadError(null);
    setLoadedBottleKey(requestedBottleKey);
    router.replace("/addBottle");
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

    const imageFile =
      image instanceof File ? image : image ? await toBlob(image) : null;

    if (imageFile) {
      try {
        await tastingImageUpdateMutation.mutateAsync({
          tasting: tasting.id,
          file: imageFile,
        });
      } catch (err) {
        logError(err);
        flash(
          "There was an error uploading your image, but the tasting was saved.",
          "error",
        );
      }
    }

    for (const award of awards) {
      if (award.level != award.prevLevel && award.level) {
        flash(
          <div className="relative flex flex-row items-center gap-x-3">
            <Link
              href={`/badges/${award.badge.id}`}
              className="absolute inset-0"
            />
            <BadgeImage badge={award.badge} size={48} level={award.level} />
            <div className="flex flex-col">
              <h5 className="font-semibold">{award.badge.name}</h5>
              <p className="font-normal">You've reached level {award.level}!</p>
            </div>
          </div>,
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

  if (loadingBottle) {
    return <LoadingBottlePanel />;
  }

  if (bottleLoadError) {
    return (
      <BottleLoadErrorPanel message={bottleLoadError} onStartOver={startOver} />
    );
  }

  if (addedEntry) {
    return (
      <AddedToLibrary
        entry={addedEntry}
        userLibraryHref={userLibraryHref}
        photoTrace={addedEntryPhotoTrace}
        onAddAnother={startOver}
        onStatusChange={(status) => void updateAddedEntryStatus(status)}
        statusError={libraryError}
        updatingStatus={libraryStatusUpdateMutation.isPending}
      />
    );
  }

  if (tastingDraft) {
    return (
      <TastingForm
        title="Log Tasting"
        initialData={{
          bottle: tastingDraft.bottle,
          imageUrl: tastingDraft.pendingImage?.imageUrl,
        }}
        suggestedTags={tastingDraft.suggestedTags}
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
      title="Add Bottle"
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
      createProposalActionLabel="Create Bottle"
      searchActionLabel="Search Bottles"
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
 * Owns the standalone Add Bottle route: auth-gated resolution, direct
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
