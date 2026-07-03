"use client";

import type { Outputs } from "@peated/server/orpc/router";
import BottleCard from "@peated/web/components/bottleCard";
import BottleResolver, {
  type BottleResolverTarget,
} from "@peated/web/components/bottleResolver";
import Button from "@peated/web/components/button";
import FormError from "@peated/web/components/formError";
import Header from "@peated/web/components/header";
import Layout from "@peated/web/components/layout";
import { getCreateBottleHref } from "@peated/web/components/search/createBottleHref";
import Spinner from "@peated/web/components/spinner";
import useAuth from "@peated/web/hooks/useAuth";
import { AuthRequired } from "@peated/web/hooks/useAuthRequired";
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
  ImageIcon,
  Plus,
  RotateCcw,
  Search,
  Wine,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";

type AddBottleIntent = "choose" | "library" | "tasting" | "view";
type CollectionBottle = Outputs["collections"]["bottles"]["create"];

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

function getViewBottleHref(
  target: Pick<BottleResolverTarget, "bottle" | "release">,
) {
  return target.release
    ? getBottleBottlingPath(target.bottle.id, target.release.id)
    : `/bottles/${target.bottle.id}`;
}

function getLogTastingHref(
  target: Pick<BottleResolverTarget, "bottle" | "release">,
) {
  const params = new URLSearchParams();
  if (target.release) params.set("release", String(target.release.id));
  const queryString = params.toString();
  return `/bottles/${target.bottle.id}/addTasting${
    queryString ? `?${queryString}` : ""
  }`;
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
  primary,
  disabled,
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  icon: ReactNode;
  primary?: boolean;
  disabled?: boolean;
}) {
  if (href) {
    return (
      <Button
        href={href}
        color={primary ? "highlight" : "default"}
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
      color={primary ? "highlight" : "default"}
      fullWidth
      icon={icon}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

function OutcomeSelection({
  target,
  intent,
  onAddToLibrary,
  onStartOver,
}: {
  target: BottleResolverTarget;
  intent: AddBottleIntent;
  onAddToLibrary: () => void;
  onStartOver: () => void;
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
                primary={intent === "library" || intent === "choose"}
              >
                Add to Library
              </OutcomeButton>
              <OutcomeButton
                href={getLogTastingHref(target)}
                icon={<Wine className="h-4 w-4" />}
                primary={intent === "tasting"}
              >
                Log Tasting
              </OutcomeButton>
              <OutcomeButton
                href={getViewBottleHref(target)}
                icon={<Eye className="h-4 w-4" />}
                primary={intent === "view"}
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

function LibraryConfirmation({
  target,
  error,
  saving,
  onCancel,
  onSubmit,
}: {
  target: BottleResolverTarget;
  error?: string;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (useScanImage: boolean) => void;
}) {
  const hasPendingImage = Boolean(target.pendingImage);
  const [useScanImage, setUseScanImage] = useState(hasPendingImage);

  useEffect(() => {
    setUseScanImage(hasPendingImage);
  }, [hasPendingImage, target.pendingImage?.id]);

  return (
    <Layout footer={null} header={<FlowHeader>{null}</FlowHeader>}>
      <div className="mx-auto mt-5 max-w-3xl space-y-5">
        <TargetPanel target={target} previewUrl={target.previewUrl} />
        <section className="rounded border border-slate-800 bg-slate-950/50 p-4 lg:p-6">
          <div className="space-y-5">
            <div>
              <h2 className="font-semibold text-white">Add to Library</h2>
              <p className="text-muted mt-1 text-sm">
                Save this bottle to your Library.
              </p>
            </div>

            {hasPendingImage ? (
              <label className="flex items-start gap-3 rounded border border-slate-800 bg-slate-950 p-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={useScanImage}
                  onChange={(event) => setUseScanImage(event.target.checked)}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-semibold text-white">
                    <ImageIcon className="h-4 w-4" />
                    Use scanned photo as Library image
                  </span>
                  <span className="text-muted mt-1 block text-sm">
                    This saves a copy on your Library entry only. It will not
                    attach the photo to a tasting or make it the public bottle
                    image.
                  </span>
                </span>
              </label>
            ) : (
              <div className="rounded border border-slate-800 bg-slate-950 p-3">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <ImageIcon className="h-4 w-4" />
                  No Library image selected
                </div>
                <p className="text-muted mt-1 text-sm">
                  You can add the bottle now without saving an image.
                </p>
              </div>
            )}

            {error && <FormError values={[error]} />}

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                color="highlight"
                fullWidth
                icon={<BookOpen className="h-4 w-4" />}
                disabled={saving}
                onClick={() => onSubmit(useScanImage)}
              >
                {saving ? "Adding..." : "Add to Library"}
              </Button>
              <Button fullWidth onClick={onCancel}>
                Back
              </Button>
            </div>
          </div>
        </section>
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
  const intent = getIntent(searchParams.get("intent"));
  const requestedBottleId = parseId(searchParams.get("bottle"));
  const requestedReleaseId = parseId(
    searchParams.get("release") ?? searchParams.get("bottling"),
  );
  const requestedTargetKey = useMemo(() => {
    if (!requestedBottleId) return null;
    return `${requestedBottleId}:${requestedReleaseId ?? "base"}`;
  }, [requestedBottleId, requestedReleaseId]);

  const [loadedTargetKey, setLoadedTargetKey] = useState<string | null>(null);
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [targetLoadError, setTargetLoadError] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] =
    useState<BottleResolverTarget | null>(null);
  const [confirmingLibrary, setConfirmingLibrary] = useState(false);
  const [libraryError, setLibraryError] = useState<string | undefined>();
  const [addedEntry, setAddedEntry] = useState<CollectionBottle | null>(null);

  const libraryCreateMutation = useMutation(
    orpc.collections.bottles.create.mutationOptions(),
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

    let cancelled = false;

    async function loadRequestedTarget() {
      setLoadingTarget(true);
      setTargetLoadError(null);
      setConfirmingLibrary(false);
      setAddedEntry(null);

      try {
        const [bottle, release] = await Promise.all([
          orpc.bottles.details.call({ bottle: requestedBottleId as number }),
          requestedReleaseId
            ? orpc.bottleReleases.details.call({
                release: requestedReleaseId,
              })
            : Promise.resolve(null),
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
    setConfirmingLibrary(false);
    setLibraryError(undefined);
    setAddedEntry(null);
    setTargetLoadError(null);
    setLoadedTargetKey(requestedTargetKey);
    router.replace("/addBottle");
  }

  async function addToLibrary(useScanImage: boolean) {
    if (!selectedTarget) return;

    setLibraryError(undefined);
    try {
      const entry = await libraryCreateMutation.mutateAsync({
        bottle: selectedTarget.bottle.id,
        release: selectedTarget.release?.id ?? null,
        user: "me",
        collection: "library",
        pendingImageId:
          useScanImage && selectedTarget.pendingImage
            ? selectedTarget.pendingImage.id
            : undefined,
      });
      setAddedEntry(entry);
      setSelectedTarget(null);
      setConfirmingLibrary(false);
    } catch (err) {
      logError(err);
      setLibraryError(
        getFormErrorMessage(err, {
          expectedErrorNames: ["BAD_REQUEST", "CONFLICT"],
        }),
      );
    }
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

  if (selectedTarget && confirmingLibrary) {
    return (
      <LibraryConfirmation
        target={selectedTarget}
        error={libraryError}
        saving={libraryCreateMutation.isPending}
        onCancel={() => {
          setLibraryError(undefined);
          setConfirmingLibrary(false);
        }}
        onSubmit={(useScanImage) => void addToLibrary(useScanImage)}
      />
    );
  }

  if (selectedTarget) {
    return (
      <OutcomeSelection
        target={selectedTarget}
        intent={intent}
        onAddToLibrary={() => {
          setLibraryError(undefined);
          setConfirmingLibrary(true);
        }}
        onStartOver={startOver}
      />
    );
  }

  return (
    <BottleResolver
      title="Add Bottle"
      searchHrefForQuery={(query) => getSearchHref(query, intent)}
      createBottleHrefForQuery={(query) =>
        getCreateBottleHref({
          query,
          returnAction: getCreateReturnAction(intent),
        })
      }
      matchedResultDescription="Use this existing bottle for your next step."
      createProposalActionLabel="Create Bottle"
      searchActionLabel="Search Again"
      enableCatalogImageApproval
      onResolve={(target) => {
        setSelectedTarget(target);
        setConfirmingLibrary(false);
        setLibraryError(undefined);
        setAddedEntry(null);
      }}
    />
  );
}

/**
 * Owns the standalone Add Bottle route: auth-gated resolution, direct
 * bottle/release query targets, and the Library terminal state stay in this
 * flow while scan image reuse remains an explicit Library choice.
 */
export default function AddBottleFlow() {
  return (
    <AuthRequired>
      <AddBottleFlowContent />
    </AuthRequired>
  );
}
