"use client";

import type { Outputs } from "@peated/server/orpc/router";
import BadgeImage from "@peated/web/components/badgeImage";
import BottleCard from "@peated/web/components/bottleCard";
import BottleResolver, {
  type BottleResolverMatchedActionsProps,
  type BottleResolverTarget,
} from "@peated/web/components/bottleResolver";
import Button from "@peated/web/components/button";
import { useFlashMessages } from "@peated/web/components/flash";
import FormError from "@peated/web/components/formError";
import Header from "@peated/web/components/header";
import Layout from "@peated/web/components/layout";
import Link from "@peated/web/components/link";
import type { CreateBottlePrefill } from "@peated/web/components/search/createBottleHref";
import { getCreateBottleHref } from "@peated/web/components/search/createBottleHref";
import Spinner from "@peated/web/components/spinner";
import TastingForm from "@peated/web/components/tastingForm";
import useAuth from "@peated/web/hooks/useAuth";
import { AuthRequired } from "@peated/web/hooks/useAuthRequired";
import { toBlob } from "@peated/web/lib/blobs";
import { getBottleBottlingPath } from "@peated/web/lib/bottlings";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
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
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

type AddBottleIntent = "choose" | "library" | "tasting" | "view";
type CollectionBottle = Outputs["collections"]["bottles"]["create"];
type SuggestedTags = Outputs["bottles"]["suggestedTags"];
type TastingSubmitData = Parameters<
  ComponentProps<typeof TastingForm>["onSubmit"]
>[0];
type TastingDraft = BottleResolverTarget & {
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

function getSearchHref(query = "", intent: AddBottleIntent = "choose") {
  const params = new URLSearchParams({
    intent: intent === "choose" ? "addBottle" : intent,
  });
  if (query) params.set("q", query);
  return `/search?${params.toString()}`;
}

function getViewBottleHrefByIds(
  bottleId: number | string,
  releaseId: number | string | null,
) {
  return releaseId
    ? getBottleBottlingPath(bottleId, releaseId)
    : `/bottles/${bottleId}`;
}

function getViewBottleHref(
  target: Pick<BottleResolverTarget, "bottle" | "release">,
) {
  return getViewBottleHrefByIds(target.bottle.id, target.release?.id ?? null);
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

function TargetPanel({
  target,
  previewUrl,
}: {
  target: Pick<BottleResolverTarget, "bottle" | "release">;
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
          <BottleCard
            bottle={target.bottle}
            release={target.release}
            color="inherit"
            noGutter
          />
        </div>
      </div>
    </section>
  );
}

function LoadingTargetPanel() {
  return (
    <Layout footer={null} header={<FlowHeader>{null}</FlowHeader>}>
      <div className="mx-auto mt-5 max-w-3xl">
        <Spinner />
      </div>
    </Layout>
  );
}

function TargetLoadErrorPanel({
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
            Search Again
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
  bottleId,
  releaseId,
  hasExactLibraryEntry,
  loadingExactLibraryStatus,
  resolvingAction,
  onResolve,
}: BottleResolverMatchedActionsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <OutcomeButton
        onClick={() => onResolve("library")}
        icon={<BookOpen className="h-4 w-4" />}
        emphasized
        disabled={
          Boolean(resolvingAction) ||
          loadingExactLibraryStatus ||
          hasExactLibraryEntry
        }
        loading={resolvingAction === "library" || loadingExactLibraryStatus}
      >
        {hasExactLibraryEntry ? "In Library" : "Add to Library"}
      </OutcomeButton>
      <OutcomeButton
        onClick={() => onResolve("tasting")}
        icon={<Wine className="h-4 w-4" />}
        emphasized
        disabled={Boolean(resolvingAction)}
        loading={resolvingAction === "tasting"}
      >
        Log Tasting
      </OutcomeButton>
      <OutcomeButton
        href={getViewBottleHrefByIds(bottleId, releaseId)}
        icon={<Eye className="h-4 w-4" />}
      >
        View Bottle
      </OutcomeButton>
    </div>
  );
}

function OutcomeSelection({
  target,
  intent,
  onAddToLibrary,
  onLogTasting,
  onStartOver,
  addingToLibrary,
  loggingTasting,
  error,
}: {
  target: BottleResolverTarget;
  intent: AddBottleIntent;
  onAddToLibrary: () => void;
  onLogTasting: () => void;
  onStartOver: () => void;
  addingToLibrary: boolean;
  loggingTasting: boolean;
  error?: string;
}) {
  return (
    <Layout footer={null} header={<FlowHeader>{null}</FlowHeader>}>
      <div className="mx-auto mt-5 max-w-3xl space-y-5">
        <TargetPanel target={target} previewUrl={target.previewUrl} />
        {target.warnings?.length ? (
          <section className="rounded border border-amber-900/70 bg-amber-950/30 p-4 text-sm text-amber-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                {target.warnings.map((warning) => (
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
              <h2 className="font-semibold text-white">Bottle found</h2>
              <p className="text-muted mt-1 text-sm">
                Choose what you want to do with this bottle.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <OutcomeButton
                onClick={onAddToLibrary}
                icon={<BookOpen className="h-4 w-4" />}
                emphasized
                disabled={
                  target.hasExactLibraryEntry ||
                  addingToLibrary ||
                  loggingTasting
                }
                loading={addingToLibrary}
              >
                {target.hasExactLibraryEntry ? "In Library" : "Add to Library"}
              </OutcomeButton>
              <OutcomeButton
                onClick={onLogTasting}
                icon={<Wine className="h-4 w-4" />}
                emphasized
                disabled={loggingTasting}
                loading={loggingTasting}
              >
                Log Tasting
              </OutcomeButton>
              <OutcomeButton
                href={getViewBottleHref(target)}
                icon={<Eye className="h-4 w-4" />}
              >
                View Bottle
              </OutcomeButton>
            </div>
          </div>
        </section>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            href={getSearchHref("", intent)}
            fullWidth
            icon={<Search className="h-4 w-4" />}
          >
            Search Again
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

function AddedToLibrary({
  entry,
  userLibraryHref,
  onAddAnother,
}: {
  entry: CollectionBottle;
  userLibraryHref: string;
  onAddAnother: () => void;
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
            <TargetPanel
              target={{ bottle: entry.bottle, release: entry.release ?? null }}
              previewUrl={entry.imageUrl}
            />
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
      </div>
    </Layout>
  );
}

function AddBottleFlowContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orpc = useORPC();
  const { flash } = useFlashMessages();
  const intent = getIntent(searchParams.get("intent"));
  const requestedBottleId = parseId(searchParams.get("bottle"));
  const requestedReleaseId = parseId(
    searchParams.get("release") ?? searchParams.get("bottling"),
  );
  const requestedFlightId = searchParams.get("flight") || null;
  const requestedTargetKey = useMemo(() => {
    if (!requestedBottleId) return null;
    return `${requestedBottleId}:${requestedReleaseId ?? "base"}`;
  }, [requestedBottleId, requestedReleaseId]);

  const [loadedTargetKey, setLoadedTargetKey] = useState<string | null>(null);
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [targetLoadError, setTargetLoadError] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] =
    useState<BottleResolverTarget | null>(null);
  const [libraryError, setLibraryError] = useState<string | undefined>();
  const [addedEntry, setAddedEntry] = useState<CollectionBottle | null>(null);
  const [tastingDraft, setTastingDraft] = useState<TastingDraft | null>(null);
  const [tastingLoadError, setTastingLoadError] = useState<
    string | undefined
  >();
  const [loadingTastingDraft, setLoadingTastingDraft] = useState(false);

  const libraryCreateMutation = useMutation(
    orpc.collections.bottles.create.mutationOptions(),
  );
  const tastingCreateMutation = useMutation(
    orpc.tastings.create.mutationOptions(),
  );
  const tastingImageUpdateMutation = useMutation(
    orpc.tastings.imageUpdate.mutationOptions(),
  );

  useEffect(() => {
    return () => {
      if (selectedTarget?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(selectedTarget.previewUrl);
      }
    };
  }, [selectedTarget?.previewUrl]);

  useEffect(() => {
    if (!requestedTargetKey || !requestedBottleId) {
      setLoadedTargetKey(null);
      return;
    }

    const bottleId = requestedBottleId;
    let cancelled = false;

    async function loadRequestedTarget() {
      setLoadingTarget(true);
      setTargetLoadError(null);
      setAddedEntry(null);
      setTastingDraft(null);
      setTastingLoadError(undefined);

      try {
        const [bottle, release, collectionStatus] = await Promise.all([
          orpc.bottles.details.call({ bottle: bottleId }),
          requestedReleaseId
            ? orpc.bottleReleases.details.call({
                release: requestedReleaseId,
              })
            : Promise.resolve(null),
          orpc.collections.bottles.list.call({
            user: "me",
            collection: "library",
            bottle: bottleId,
            release: requestedReleaseId ?? undefined,
            baseOnly: requestedReleaseId == null,
          }),
        ]);

        if (cancelled) return;
        if (release && release.bottleId !== bottle.id) {
          setSelectedTarget(null);
          setLoadedTargetKey(null);
          setTargetLoadError(
            "We couldn't load that bottling for this bottle. Search again or start over.",
          );
          return;
        }
        setSelectedTarget({
          bottle,
          release,
          hasExactLibraryEntry: collectionStatus.results.length > 0,
          pendingImage: null,
          previewUrl: null,
        });
        setLoadedTargetKey(requestedTargetKey);
      } catch (err) {
        logError(err);
        if (cancelled) return;
        setSelectedTarget(null);
        setLoadedTargetKey(null);
        setTargetLoadError(
          "We couldn't load that bottle. Search again or start over.",
        );
      } finally {
        if (!cancelled) setLoadingTarget(false);
      }
    }

    if (loadedTargetKey !== requestedTargetKey) {
      void loadRequestedTarget();
    }

    return () => {
      cancelled = true;
    };
  }, [
    loadedTargetKey,
    orpc,
    requestedBottleId,
    requestedReleaseId,
    requestedTargetKey,
  ]);

  function startOver() {
    setSelectedTarget(null);
    setLibraryError(undefined);
    setAddedEntry(null);
    setTastingDraft(null);
    setTastingLoadError(undefined);
    setTargetLoadError(null);
    setLoadedTargetKey(requestedTargetKey);
    router.replace("/addBottle");
  }

  async function startLogTasting(target: BottleResolverTarget) {
    setTastingLoadError(undefined);
    setLoadingTastingDraft(true);
    try {
      const suggestedTags = await orpc.bottles.suggestedTags.call({
        bottle: target.bottle.id,
      });
      setLibraryError(undefined);
      setTastingDraft({
        ...target,
        suggestedTags,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      logError(err);
      setTastingLoadError(
        "We couldn't load the tasting form. Try again or search for the bottle.",
      );
    } finally {
      setLoadingTastingDraft(false);
    }
  }

  async function handleResolvedTarget(
    target: BottleResolverTarget,
    action?: "library" | "tasting",
  ) {
    setSelectedTarget(target);
    setLibraryError(undefined);
    setAddedEntry(null);
    setTastingDraft(null);
    setTastingLoadError(undefined);

    if (action === "library") {
      await addToLibrary(target);
    } else if (action === "tasting") {
      await startLogTasting(target);
    }
  }

  async function addToLibrary(target = selectedTarget) {
    if (!target) return;

    setSelectedTarget(target);
    setLibraryError(undefined);
    setTastingDraft(null);
    if (target.hasExactLibraryEntry) return;

    try {
      const entry = await libraryCreateMutation.mutateAsync({
        bottle: target.bottle.id,
        release: target.release?.id ?? null,
        user: "me",
        collection: "library",
        pendingImageId: target.pendingImage?.id,
      });
      setAddedEntry(entry);
      setSelectedTarget(null);
    } catch (err) {
      logError(err);
      setLibraryError(
        getFormErrorMessage(err, {
          expectedErrorNames: ["BAD_REQUEST", "CONFLICT"],
          fallbackMessage: "Could not save to Library.",
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
      bottle: tastingDraft.bottle.id,
      release:
        data.release === undefined
          ? (tastingDraft.release?.id ?? null)
          : data.release,
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

  if (loadingTarget) {
    return <LoadingTargetPanel />;
  }

  if (targetLoadError) {
    return (
      <TargetLoadErrorPanel message={targetLoadError} onStartOver={startOver} />
    );
  }

  if (addedEntry) {
    return (
      <AddedToLibrary
        entry={addedEntry}
        userLibraryHref={
          user?.username ? `/users/${user.username}/library` : "/bottles"
        }
        onAddAnother={startOver}
      />
    );
  }

  if (tastingDraft) {
    return (
      <TastingForm
        title="Log Tasting"
        initialData={{
          bottle: tastingDraft.bottle,
          release: tastingDraft.release,
          imageUrl: tastingDraft.pendingImage?.imageUrl,
        }}
        showReleasePickerDefault
        suggestedTags={tastingDraft.suggestedTags}
        onSubmit={submitTasting}
      />
    );
  }

  if (selectedTarget) {
    return (
      <OutcomeSelection
        target={selectedTarget}
        intent={intent}
        error={libraryError ?? tastingLoadError}
        onAddToLibrary={() => {
          setLibraryError(undefined);
          setTastingDraft(null);
          setTastingLoadError(undefined);
          void addToLibrary(selectedTarget);
        }}
        onLogTasting={() => void startLogTasting(selectedTarget)}
        onStartOver={startOver}
        addingToLibrary={libraryCreateMutation.isPending}
        loggingTasting={loadingTastingDraft}
      />
    );
  }

  return (
    <BottleResolver
      title="Add Bottle"
      searchHrefForQuery={(query) => getSearchHref(query, intent)}
      createBottleHrefForResult={(
        query: string,
        prefill?: CreateBottlePrefill,
      ) =>
        getCreateBottleHref({
          query,
          returnAction: getCreateReturnAction(intent),
          prefill,
        })
      }
      matchedResultDescription="We identified this bottle in Peated."
      createProposalActionLabel="Create Bottle"
      searchActionLabel="Search Again"
      enableCatalogImageApproval
      renderMatchedResultActions={(props) => (
        <MatchedOutcomeActions {...props} />
      )}
      onResolve={handleResolvedTarget}
    />
  );
}

/**
 * Owns the standalone Add Bottle route: auth-gated resolution, direct
 * bottle/release query targets, direct Library saves, and tasting continuation
 * stay in this flow so scan image reuse remains attached to the user's action.
 */
export default function AddBottleFlow() {
  return (
    <AuthRequired>
      <AddBottleFlowContent />
    </AuthRequired>
  );
}
