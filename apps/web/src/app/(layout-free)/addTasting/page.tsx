"use client";

import type { Outputs } from "@peated/server/orpc/router";
import type { Bottle, BottleRelease } from "@peated/server/types";
import BadgeImage from "@peated/web/components/badgeImage";
import Button from "@peated/web/components/button";
import { useFlashMessages } from "@peated/web/components/flash";
import FormError from "@peated/web/components/formError";
import Header from "@peated/web/components/header";
import Layout from "@peated/web/components/layout";
import Link from "@peated/web/components/link";
import TastingForm from "@peated/web/components/tastingForm";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { toBlob } from "@peated/web/lib/blobs";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronLeft,
  LoaderCircle,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type PhotoIdentification = Outputs["tastings"]["photoIdentification"];
type SuggestedTags = Outputs["bottles"]["suggestedTags"];

type SelectedTarget = {
  bottle: Bottle;
  release: BottleRelease | null;
  suggestedTags: SuggestedTags;
};

const loadingMessages = [
  "Holding it up to the light",
  "Letting the label breathe",
  "Checking the dusty shelf",
  "Asking the tasting room",
  "Comparing the fine print",
];

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getFieldValue(
  result: PhotoIdentification | null,
  field: keyof PhotoIdentification["imageEvidence"]["fieldCandidates"],
) {
  const value = result?.imageEvidence.fieldCandidates[field]?.value;
  if (value === undefined || value === null) return null;
  if (field === "statedAge") return `${value} years`;
  if (field === "abv") return `${value}% ABV`;
  return String(value);
}

function getSearchSeed(result: PhotoIdentification | null) {
  const brand = getFieldValue(result, "brand");
  const expression = getFieldValue(result, "expression");
  return [brand, expression].filter(Boolean).join(" ");
}

function getSearchHref(query = "") {
  return `/search?tasting${query ? `&q=${encodeURIComponent(query)}` : ""}`;
}

function getMatchedBottleId(result: PhotoIdentification | null) {
  if (
    result?.suggestedNextStep === "confirm_match" &&
    result.classification.status === "classified" &&
    result.classification.decision.action === "match"
  ) {
    return result.classification.decision.matchedBottleId;
  }
  return null;
}

function getMatchedReleaseId(result: PhotoIdentification | null) {
  if (
    result?.classification.status === "classified" &&
    result.classification.decision.action === "match"
  ) {
    return result.classification.decision.matchedReleaseId;
  }
  return null;
}

function getCreateDecision(result: PhotoIdentification | null) {
  if (
    result?.suggestedNextStep !== "confirm_create" ||
    result.classification.status !== "classified"
  ) {
    return null;
  }

  switch (result.classification.decision.action) {
    case "create_bottle":
    case "create_release":
    case "create_bottle_and_release":
      return result.classification.decision;
    default:
      return null;
  }
}

function getProposedName(result: PhotoIdentification | null) {
  const decision = getCreateDecision(result);
  if (!decision) return null;

  if (decision.action === "create_release") {
    return decision.proposedRelease.edition ?? "New release";
  }

  if (decision.action === "create_bottle_and_release") {
    return [
      decision.proposedBottle.brand.name,
      decision.proposedBottle.name,
      decision.proposedRelease.edition,
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [decision.proposedBottle.brand.name, decision.proposedBottle.name]
    .filter(Boolean)
    .join(" ");
}

function getParentBottleName(result: PhotoIdentification | null) {
  const decision = getCreateDecision(result);
  if (!decision || decision.action !== "create_release") return null;

  const parent = result?.classification.artifacts.candidates.find(
    (candidate) =>
      candidate.bottleId === decision.parentBottleId &&
      (candidate.releaseId === null || candidate.releaseId === undefined),
  );
  return parent?.bottleFullName || parent?.fullName || null;
}

function getCreateProposalLabel(result: PhotoIdentification | null) {
  const decision = getCreateDecision(result);
  if (!decision) return null;
  const parentBottleName = getParentBottleName(result);

  if (decision.action === "create_release") {
    return {
      title: "Bottle found",
      description: parentBottleName
        ? `Create a new bottling for ${parentBottleName}.`
        : "Create a new bottling for this bottle.",
    };
  }

  if (decision.action === "create_bottle_and_release") {
    return {
      title: "Bottle found",
      description: "Create the bottle and its specific bottling.",
    };
  }

  return {
    title: "Bottle found",
    description: "Create a new bottle from this label.",
  };
}

function EvidencePills({ result }: { result: PhotoIdentification | null }) {
  const fields = [
    ["Brand", getFieldValue(result, "brand")],
    ["Expression", getFieldValue(result, "expression")],
    ["Age", getFieldValue(result, "statedAge")],
    ["ABV", getFieldValue(result, "abv")],
    ["Edition", getFieldValue(result, "edition")],
    ["Vintage", getFieldValue(result, "vintageYear")],
  ].filter(([, value]) => value);

  if (!fields.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {fields.map(([label, value]) => (
        <div
          key={label}
          className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
        >
          <span className="text-muted">{label}</span>{" "}
          <span className="font-medium text-white">{value}</span>
        </div>
      ))}
    </div>
  );
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-slate-800" />
      <div className="text-muted text-xs font-semibold uppercase tracking-wide">
        Or
      </div>
      <div className="h-px flex-1 bg-slate-800" />
    </div>
  );
}

function FallbackActions({
  searchHref,
  onStartOver,
  showStartOver = false,
}: {
  searchHref: string;
  onStartOver?: () => void;
  showStartOver?: boolean;
}) {
  return (
    <div className="space-y-3">
      <OrDivider />
      <div className="mx-auto grid w-full gap-3 sm:w-1/2 sm:grid-cols-2">
        <Button
          href={searchHref}
          fullWidth
          icon={<Search className="h-4 w-4" />}
        >
          Search Bottles
        </Button>
        {showStartOver && onStartOver && (
          <Button
            fullWidth
            onClick={onStartOver}
            icon={<RotateCcw className="h-4 w-4" />}
          >
            Start Over
          </Button>
        )}
      </div>
    </div>
  );
}

function SearchBottleCallout() {
  return (
    <section className="mx-3 rounded border border-slate-800 bg-slate-950/50 p-4 sm:mx-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-semibold text-white">Prefer to search?</div>
          <div className="text-muted mt-1 text-sm">
            Find an existing bottle or start a new one manually.
          </div>
        </div>
        <div className="shrink-0">
          <Button href="/search?tasting" icon={<Search className="h-4 w-4" />}>
            Search Bottles
          </Button>
        </div>
      </div>
    </section>
  );
}

export default function AddTasting() {
  useAuthRequired();

  const router = useRouter();
  const orpc = useORPC();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const createdAt = useMemo(() => new Date().toISOString(), []);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoResult, setPhotoResult] = useState<PhotoIdentification | null>(
    null,
  );
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const { flash } = useFlashMessages();
  const photoIdentificationMutation = useMutation(
    orpc.tastings.photoIdentification.mutationOptions(),
  );
  const tastingCreateMutation = useMutation(
    orpc.tastings.create.mutationOptions(),
  );
  const tastingImageUpdateMutation = useMutation(
    orpc.tastings.imageUpdate.mutationOptions(),
  );
  const photoIdentificationCreateMutation = useMutation(
    orpc.tastings.photoIdentificationCreate.mutationOptions(),
  );
  const isIdentifying = photoIdentificationMutation.isPending;
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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

  async function loadTarget(bottleId: number, releaseId: number | null = null) {
    const [bottle, suggestedTags, release] = await Promise.all([
      orpc.bottles.details.call({ bottle: bottleId }),
      orpc.bottles.suggestedTags.call({ bottle: bottleId }),
      releaseId
        ? orpc.bottleReleases.details.call({ release: releaseId })
        : Promise.resolve(null),
    ]);
    setSelectedTarget({ bottle, release, suggestedTags });
  }

  async function acceptCreateProposal(result: PhotoIdentification) {
    if (
      result.classification.status !== "classified" ||
      !getCreateDecision(result)
    ) {
      return;
    }

    try {
      const created = await photoIdentificationCreateMutation.mutateAsync({
        pendingImageId: result.pendingImage.id,
      });
      const suggestedTags = await orpc.bottles.suggestedTags.call({
        bottle: created.bottle.id,
      });
      setSelectedTarget({
        bottle: created.bottle,
        release: created.release,
        suggestedTags,
      });
    } catch (err) {
      logError(err);
      setError(
        "We couldn't create that bottle from the photo. Search for the bottle to keep going.",
      );
    }
  }

  async function identifyPhoto(file: File) {
    setError(null);
    setPhotoResult(null);
    setPhotoFile(file);

    const nextPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return nextPreviewUrl;
    });

    try {
      const result = await photoIdentificationMutation.mutateAsync({
        file,
        idempotencyKey: createIdempotencyKey(),
      });
      setPhotoResult(result);
    } catch (err) {
      logError(err);
      setError(
        "We couldn't read that photo. You can still find the bottle manually.",
      );
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
    setPhotoResult(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setPhotoFile(null);
  }

  async function submitTasting({
    image,
    ...data
  }: Parameters<React.ComponentProps<typeof TastingForm>["onSubmit"]>[0]) {
    if (!selectedTarget) return;

    const { tasting, awards } = await tastingCreateMutation.mutateAsync({
      ...data,
      bottle: selectedTarget.bottle.id,
      release:
        data.release === undefined
          ? (selectedTarget.release?.id ?? null)
          : data.release,
      createdAt,
    });

    if (!tasting) return;

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

    router.push(`/tastings/${tasting.id}`);
  }

  if (selectedTarget) {
    return (
      <TastingForm
        title="Record Tasting"
        initialData={{
          bottle: selectedTarget.bottle,
          release: selectedTarget.release,
        }}
        initialImageFile={photoFile}
        showReleasePickerDefault
        suggestedTags={selectedTarget.suggestedTags}
        onSubmit={submitTasting}
      />
    );
  }

  const matchedBottleId = getMatchedBottleId(photoResult);
  const matchedReleaseId = getMatchedReleaseId(photoResult);
  const createDecision = getCreateDecision(photoResult);
  const proposedName = getProposedName(photoResult);
  const createProposalLabel = getCreateProposalLabel(photoResult);
  const searchSeed = getSearchSeed(photoResult);
  const searchHref = getSearchHref(searchSeed);

  return (
    <Layout
      footer={null}
      header={
        <Header>
          <div className="flex w-full items-center gap-3">
            <button
              type="button"
              aria-label="Back"
              className="text-muted group flex justify-center"
              onClick={() => router.back()}
            >
              <div className="-my-1 rounded bg-slate-800 p-1 group-hover:bg-slate-700 group-hover:text-white">
                <ChevronLeft className="h-8 w-8" />
              </div>
            </button>
            <h1 className="text-2xl font-bold">Record Tasting</h1>
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
          <>
            <section className="px-3 sm:px-0">
              <div className="space-y-5">
                <div className="text-center">
                  <div className="text-muted text-sm">
                    Start with a bottle photo
                  </div>
                  <h2 className="mt-1 text-2xl font-semibold text-white">
                    Capture the label, then confirm the match.
                  </h2>
                </div>

                <button
                  type="button"
                  className="flex min-h-72 w-full flex-col items-center justify-center gap-4 rounded border border-slate-800 bg-black p-6 text-center transition hover:border-slate-700 hover:bg-slate-950"
                  onClick={() => fileInputRef.current?.click()}
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
            <SearchBottleCallout />
          </>
        )}

        {!isIdentifying && previewUrl && !photoResult && (
          <>
            <section className="rounded border border-slate-800 bg-slate-950/50 p-4 lg:p-6">
              <div className="space-y-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <img
                    src={previewUrl}
                    alt="Selected bottle label"
                    className="h-24 w-24 rounded object-cover"
                  />
                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="text-highlight rounded-full bg-slate-800 p-2">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-white">
                          Use search instead
                        </div>
                        <div className="text-muted mt-1 text-sm">
                          We could not read enough from this photo. Search can
                          still find an existing bottle or start a new one.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            <FallbackActions
              searchHref="/search?tasting"
              showStartOver
              onStartOver={startOver}
            />
          </>
        )}

        {isIdentifying && (
          <section className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-3 py-8 text-center">
            <div className="mx-auto max-w-md space-y-5">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Selected bottle label"
                  className="mx-auto h-28 w-28 rounded object-cover"
                />
              )}
              <div>
                <LoaderCircle className="text-highlight mx-auto h-8 w-8 animate-spin" />
                <h2 className="mt-4 text-xl font-semibold text-white">
                  {loadingMessages[loadingMessageIndex]}
                </h2>
                <p className="text-muted mt-2 text-sm">
                  Reading the label and checking Peated for a match.
                </p>
                <p className="text-muted mt-1 text-sm">
                  This can take up to 30 seconds.
                </p>
                <div className="mt-5">
                  <Button
                    href="/search?tasting"
                    icon={<Search className="h-4 w-4" />}
                  >
                    Search Bottles
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}

        {!isIdentifying && photoResult && (
          <>
            <section className="rounded border border-slate-800 bg-slate-950/50 p-4 lg:p-6">
              <div className="space-y-5">
                <div className="space-y-4">
                  {matchedBottleId ? (
                    <div className="flex items-start gap-3">
                      {previewUrl && (
                        <img
                          src={previewUrl}
                          alt=""
                          className="h-8 w-8 rounded object-cover"
                        />
                      )}
                      <div className="bg-highlight rounded-full p-2 text-black">
                        <Check className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-white">
                          Match found
                        </div>
                        <div className="text-muted mt-1 text-sm">
                          We'll use the existing bottle for this tasting.
                        </div>
                      </div>
                    </div>
                  ) : createDecision ? (
                    <div className="flex items-start gap-3">
                      {previewUrl && (
                        <img
                          src={previewUrl}
                          alt=""
                          className="h-8 w-8 rounded object-cover"
                        />
                      )}
                      <div className="bg-highlight rounded-full p-2 text-black">
                        <Plus className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-white">
                          {createProposalLabel?.title ?? "New bottle found"}
                        </div>
                        <div className="text-muted mt-1 text-sm">
                          {createProposalLabel?.description ??
                            "We'll create this bottle before recording your tasting."}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      {previewUrl && (
                        <img
                          src={previewUrl}
                          alt=""
                          className="h-8 w-8 rounded object-cover"
                        />
                      )}
                      <div className="text-highlight rounded-full bg-slate-800 p-2">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-white">
                          Needs manual review
                        </div>
                        <div className="text-muted mt-1 text-sm">
                          We kept the photo. Search for the bottle to keep
                          going.
                        </div>
                      </div>
                    </div>
                  )}

                  <EvidencePills result={photoResult} />

                  {createDecision && proposedName && (
                    <div className="rounded border border-slate-800 bg-slate-950 p-3">
                      <div className="text-muted text-xs uppercase tracking-wide">
                        Proposed
                      </div>
                      <div className="mt-1 font-semibold text-white">
                        {proposedName}
                      </div>
                      <div className="text-muted mt-2 text-sm">
                        {createProposalLabel?.description ??
                          "Create a new bottle from this label."}
                      </div>
                      {photoResult.diagnostics.classification.reason && (
                        <div className="text-muted mt-2 line-clamp-3 text-xs">
                          {photoResult.diagnostics.classification.reason}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="mx-auto grid w-full gap-2 sm:w-1/2">
                  {matchedBottleId && (
                    <Button
                      color="highlight"
                      fullWidth
                      onClick={() =>
                        void loadTarget(matchedBottleId, matchedReleaseId)
                      }
                    >
                      Continue
                    </Button>
                  )}
                  {createDecision && (
                    <Button
                      color="highlight"
                      fullWidth
                      icon={<Plus className="h-4 w-4" />}
                      onClick={() => void acceptCreateProposal(photoResult)}
                      disabled={photoIdentificationCreateMutation.isPending}
                    >
                      {photoIdentificationCreateMutation.isPending
                        ? "Creating..."
                        : "Continue"}
                    </Button>
                  )}
                </div>
              </div>
            </section>
            <FallbackActions
              searchHref={searchHref}
              showStartOver
              onStartOver={startOver}
            />
          </>
        )}

        {error && <FormError values={[error]} />}
      </div>
    </Layout>
  );
}
