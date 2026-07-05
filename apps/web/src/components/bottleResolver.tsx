"use client";

import type { Inputs, Outputs } from "@peated/server/orpc/router";
import type { Bottle, BottleRelease } from "@peated/server/types";
import Button from "@peated/web/components/button";
import FormError from "@peated/web/components/formError";
import Header from "@peated/web/components/header";
import Layout from "@peated/web/components/layout";
import type { CreateBottlePrefill } from "@peated/web/components/search/createBottleHref";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { isORPCUnauthorizedRedirectError } from "@peated/web/lib/orpc/link";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronLeft,
  ImageIcon,
  Plus,
  RotateCcw,
  Search,
  SearchX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

type PhotoIdentification = Outputs["tastings"]["photoIdentification"];

export type BottleResolverTarget = {
  bottle: Bottle;
  release: BottleRelease | null;
  hasExactLibraryEntry: boolean;
  pendingImage: PhotoIdentification["pendingImage"] | null;
  /** Blob preview ownership transfers to the resolver caller only after onResolve succeeds. */
  previewUrl: string | null;
  warnings?: string[];
};

export type BottleResolverMatchedAction = "library" | "tasting";

export type BottleResolverMatchedActionsProps = {
  bottleId: number;
  releaseId: number | null;
  hasExactLibraryEntry: boolean;
  loadingExactLibraryStatus: boolean;
  resolvingAction: BottleResolverMatchedAction | null;
  onResolve: (action: BottleResolverMatchedAction) => void;
};

type Props = {
  onResolve: (
    target: BottleResolverTarget,
    action?: BottleResolverMatchedAction,
  ) => Promise<void> | void;
  searchHrefForQuery: (query?: string) => string;
  createBottleHrefForResult?: (
    query: string,
    prefill?: CreateBottlePrefill,
  ) => string;
  title: string;
  matchedResultDescription?: string;
  renderMatchedResultActions?: (
    props: BottleResolverMatchedActionsProps,
  ) => ReactNode;
  createProposalActionLabel?: string;
  searchActionLabel?: string;
  enableCatalogImageApproval?: boolean;
};

type CatalogImageApprovalTarget = "bottle" | "release";
type ManualResultCopy = {
  title: string;
  description: string;
  createLabel?: string;
  primaryAction?: "search" | "create";
};
type PhotoIdentificationCreateInput =
  Inputs["tastings"]["photoIdentificationCreate"];

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

function getRawFieldValue(
  result: PhotoIdentification | null,
  field: keyof PhotoIdentification["imageEvidence"]["fieldCandidates"],
) {
  const value = result?.imageEvidence.fieldCandidates[field]?.value;
  if (value === undefined || value === null || value === "") return null;
  return value;
}

function getRawStringFieldValue(
  result: PhotoIdentification | null,
  field: keyof PhotoIdentification["imageEvidence"]["fieldCandidates"],
) {
  const value = getRawFieldValue(result, field);
  return typeof value === "string" ? value : null;
}

function getRawNumberFieldValue(
  result: PhotoIdentification | null,
  field: keyof PhotoIdentification["imageEvidence"]["fieldCandidates"],
) {
  const value = getRawFieldValue(result, field);
  return typeof value === "number" ? value : null;
}

function getSearchSeed(result: PhotoIdentification | null) {
  const brand = getFieldValue(result, "brand");
  const expression = getFieldValue(result, "expression");
  return [brand, expression].filter(Boolean).join(" ");
}

function getCreateNameSeed(result: PhotoIdentification | null) {
  const decision = getCreateDecisionLike(result);
  return (
    getRawStringFieldValue(result, "expression") ??
    getProposedBottle(decision)?.name ??
    ""
  );
}

function getCreateBottlePrefill(
  result: PhotoIdentification | null,
): CreateBottlePrefill {
  const decision = getCreateDecisionLike(result);
  const proposedBottle = getProposedBottle(decision);
  const proposedRelease = getProposedRelease(decision);

  return {
    brandName:
      getRawStringFieldValue(result, "brand") ??
      proposedBottle?.brand.name ??
      null,
    statedAge: getRawNumberFieldValue(result, "statedAge"),
    abv: getRawNumberFieldValue(result, "abv"),
    edition:
      getRawStringFieldValue(result, "edition") ??
      proposedRelease?.edition ??
      null,
    vintageYear: getRawNumberFieldValue(result, "vintageYear"),
    releaseYear: getRawNumberFieldValue(result, "releaseYear"),
  };
}

function hasRecognizedLabelDetails(result: PhotoIdentification | null) {
  return Boolean(
    getFieldValue(result, "brand") ||
    getFieldValue(result, "expression") ||
    getFieldValue(result, "statedAge") ||
    getFieldValue(result, "abv") ||
    getFieldValue(result, "edition") ||
    getFieldValue(result, "vintageYear"),
  );
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

  return getCreateDecisionLike(result);
}

function getCreateDecisionLike(result: PhotoIdentification | null) {
  if (result?.classification.status !== "classified") {
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

type CreateDecisionLike = NonNullable<ReturnType<typeof getCreateDecisionLike>>;

function getProposedBottle(decision: CreateDecisionLike | null) {
  if (!decision) return null;
  if (
    decision.action === "create_bottle" ||
    decision.action === "create_bottle_and_release"
  ) {
    return decision.proposedBottle;
  }
  return null;
}

function getProposedRelease(decision: CreateDecisionLike | null) {
  if (!decision) return null;
  if (
    decision.action === "create_release" ||
    decision.action === "create_bottle_and_release"
  ) {
    return decision.proposedRelease;
  }
  return null;
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
      title: "Bottling not in Peated",
      description: parentBottleName
        ? `Create a new bottling for ${parentBottleName}.`
        : "Create a new bottling for this bottle.",
    };
  }

  if (decision.action === "create_bottle_and_release") {
    return {
      title: "Bottle not in Peated",
      description: "Create the bottle and its specific bottling.",
    };
  }

  return {
    title: "Bottle not in Peated",
    description: "Create a new bottle from this label.",
  };
}

function getCatalogImageApprovalTarget(
  action: "create_bottle" | "create_release" | "create_bottle_and_release",
): CatalogImageApprovalTarget {
  return action === "create_bottle" ? "bottle" : "release";
}

function getAllowedCatalogImageApprovalTarget(
  result: PhotoIdentification,
  enabled: boolean,
) {
  const decision = getCreateDecision(result);
  if (
    !enabled ||
    !decision ||
    result.imageEvidence.photoSuitability.suitableAsBottleImage !== true
  ) {
    return null;
  }

  return getCatalogImageApprovalTarget(decision.action);
}

function getCatalogImageApprovalCopy(target: CatalogImageApprovalTarget) {
  if (target === "bottle") {
    return {
      label: "Set as Bottle Image",
      help: "This photo will be shown as the public image for the new bottle.",
    };
  }

  return {
    label: "Set as Release Image",
    help: "This photo will be shown as the public image for the new release.",
  };
}

function getManualResultCopy(
  result: PhotoIdentification | null,
): ManualResultCopy {
  const action =
    result?.classification.status === "classified"
      ? result.classification.decision.action
      : null;

  if (result?.suggestedNextStep === "needs_review") {
    return {
      title: "We couldn't identify this bottle",
      description:
        "We found a possible match, but it was not reliable enough to use automatically. Search can still find the right bottle.",
      createLabel: undefined,
    };
  }

  if (action === "match") {
    return {
      title: "We couldn't confirm the match",
      description:
        "We found a possible match, but it was not reliable enough to use automatically.",
      createLabel: undefined,
    };
  }

  if (action === "no_match") {
    if (hasRecognizedLabelDetails(result)) {
      return {
        title: "We couldn't find this bottle",
        description:
          "We found label details, but not enough to choose an existing bottle automatically. Review them before creating it in Peated.",
        createLabel: "Create Bottle",
        primaryAction: "create" as const,
      };
    }

    return {
      title: "We couldn't identify the bottle",
      description:
        "Search can still find it, or you can start over with a clearer photo.",
      createLabel: "Create Manually",
      primaryAction: "search" as const,
    };
  }

  if (
    action === "create_bottle" ||
    action === "create_release" ||
    action === "create_bottle_and_release"
  ) {
    return {
      title: "We couldn't find this bottle",
      description:
        "We found label details, but not enough to choose an existing bottle automatically. Review them before creating it in Peated.",
      createLabel: "Create Bottle",
      primaryAction: "create" as const,
    };
  }

  return {
    title: "We couldn't identify the bottle",
    description:
      "Search can still find it, or you can start over with another photo.",
    createLabel: "Create Manually",
    primaryAction: "search" as const,
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

function ResultHeader({
  previewUrl,
  icon,
  title,
  description,
  children,
}: {
  previewUrl: string | null;
  icon: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      {previewUrl && (
        <img
          src={previewUrl}
          alt=""
          className="h-16 w-16 shrink-0 rounded object-cover sm:h-[96px] sm:w-[96px]"
        />
      )}
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-start gap-3">
          {icon}
          <div>
            <div className="font-semibold text-white">{title}</div>
            <div className="text-muted mt-1 text-sm">{description}</div>
          </div>
        </div>
        {children}
      </div>
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

function PhotoFailurePanel({
  previewUrl,
  title,
  description,
  searchHref,
  searchLabel,
  createBottleHref,
  createBottleLabel = "Create Manually",
  primaryAction = "search",
  onStartOver,
  variant,
  children,
}: {
  previewUrl: string | null;
  title: string;
  description: string;
  searchHref: string;
  searchLabel: string;
  createBottleHref?: string | null;
  createBottleLabel?: string;
  primaryAction?: "search" | "create";
  onStartOver: () => void;
  variant: "error" | "no-match";
  children?: ReactNode;
}) {
  const isError = variant === "error";

  return (
    <div
      className={`rounded border p-4 lg:p-6 ${
        isError
          ? "border-red-900/70 bg-red-950/20"
          : "border-slate-800 bg-slate-950/50"
      }`}
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Selected bottle label"
              className="h-24 w-24 rounded object-cover"
            />
          )}
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`rounded-full p-2 ${
                  isError
                    ? "bg-red-900/60 text-red-100"
                    : "text-highlight bg-slate-800"
                }`}
              >
                {isError ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <SearchX className="h-5 w-5" />
                )}
              </div>
              <div>
                <div className="font-semibold text-white">{title}</div>
                <div className="text-muted mt-1 text-sm">{description}</div>
              </div>
            </div>
            {children}
          </div>
        </div>
        <div
          className={`grid w-full gap-3 ${
            createBottleHref ? "sm:grid-cols-3" : "sm:grid-cols-2"
          }`}
        >
          {primaryAction === "create" && createBottleHref ? (
            <>
              <Button
                href={createBottleHref}
                color="highlight"
                fullWidth
                icon={<Plus className="h-4 w-4" />}
              >
                {createBottleLabel}
              </Button>
              <Button
                href={searchHref}
                fullWidth
                icon={<Search className="h-4 w-4" />}
              >
                {searchLabel}
              </Button>
            </>
          ) : (
            <>
              <Button
                href={searchHref}
                color="highlight"
                fullWidth
                icon={<Search className="h-4 w-4" />}
              >
                {searchLabel}
              </Button>
              {createBottleHref && (
                <Button
                  href={createBottleHref}
                  fullWidth
                  icon={<Plus className="h-4 w-4" />}
                >
                  {createBottleLabel}
                </Button>
              )}
            </>
          )}
          <Button
            fullWidth
            onClick={onStartOver}
            icon={<RotateCcw className="h-4 w-4" />}
          >
            Start Over
          </Button>
        </div>
      </div>
    </div>
  );
}

function FallbackActions({
  searchHref,
  searchLabel,
  onStartOver,
  showStartOver = false,
}: {
  searchHref: string;
  searchLabel: string;
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
          {searchLabel}
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

function SearchBottleCallout({ searchHref }: { searchHref: string }) {
  return (
    <section className="mx-3 rounded border border-slate-800 bg-slate-950/50 p-4 sm:mx-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-semibold text-white">Prefer to search?</div>
          <div className="text-muted mt-1 text-sm">
            Find a bottle in Peated or start a new one manually.
          </div>
        </div>
        <div className="shrink-0">
          <Button href={searchHref} icon={<Search className="h-4 w-4" />}>
            Search Bottles
          </Button>
        </div>
      </div>
    </section>
  );
}

export default function BottleResolver({
  onResolve,
  searchHrefForQuery,
  createBottleHrefForResult,
  title,
  matchedResultDescription = "We identified this bottle in Peated.",
  renderMatchedResultActions,
  createProposalActionLabel = "Continue",
  searchActionLabel = "Search Bottles",
  enableCatalogImageApproval = false,
}: Props) {
  const router = useRouter();
  const orpc = useORPC();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const transferredPreviewUrlRef = useRef<string | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoResult, setPhotoResult] = useState<PhotoIdentification | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [catalogImageApproved, setCatalogImageApproved] = useState(false);
  const [resolvingAction, setResolvingAction] =
    useState<BottleResolverMatchedAction | null>(null);
  const [matchedBottleStatus, setMatchedBottleStatus] = useState<{
    bottleId: number;
    releaseId: number | null;
    hasExactLibraryEntry: boolean;
    loading: boolean;
  } | null>(null);

  const photoIdentificationMutation = useMutation(
    orpc.tastings.photoIdentification.mutationOptions(),
  );
  const photoIdentificationCreateMutation = useMutation(
    orpc.tastings.photoIdentificationCreate.mutationOptions(),
  );
  const isIdentifying = photoIdentificationMutation.isPending;

  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      const current = previewUrlRef.current;
      if (current && current !== transferredPreviewUrlRef.current) {
        URL.revokeObjectURL(current);
      }
    };
  }, []);

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

  function replacePreviewUrl(nextPreviewUrl: string | null) {
    setPreviewUrl((current) => {
      if (current && current !== transferredPreviewUrlRef.current) {
        URL.revokeObjectURL(current);
      }
      return nextPreviewUrl;
    });
  }

  async function resolveTarget(
    target: {
      bottle: Bottle;
      release: BottleRelease | null;
      hasExactLibraryEntry: boolean;
      warnings?: string[];
    },
    action?: BottleResolverMatchedAction,
  ) {
    const currentPreviewUrl = previewUrl;
    await onResolve(
      {
        ...target,
        pendingImage: photoResult?.pendingImage ?? null,
        previewUrl: currentPreviewUrl,
      },
      action,
    );
    transferredPreviewUrlRef.current = currentPreviewUrl;
  }

  async function loadTarget(
    bottleId: number,
    releaseId: number | null = null,
    action?: BottleResolverMatchedAction,
  ) {
    setError(null);
    setResolvingAction(action ?? "library");
    try {
      const [bottle, release, collectionStatus] = await Promise.all([
        orpc.bottles.details.call({ bottle: bottleId }),
        releaseId
          ? orpc.bottleReleases.details.call({ release: releaseId })
          : Promise.resolve(null),
        orpc.collections.bottles.list.call({
          user: "me",
          collection: "library",
          bottle: bottleId,
          release: releaseId ?? undefined,
          baseOnly: releaseId == null,
        }),
      ]);
      await resolveTarget(
        {
          bottle,
          release,
          hasExactLibraryEntry: collectionStatus.results.length > 0,
        },
        action,
      );
    } catch (err) {
      logError(err);
      setError("We couldn't load that bottle. Search for it to keep going.");
    } finally {
      setResolvingAction(null);
    }
  }

  async function acceptCreateProposal(result: PhotoIdentification) {
    if (
      result.classification.status !== "classified" ||
      !getCreateDecision(result)
    ) {
      return;
    }

    try {
      const catalogImageApprovalTarget = getAllowedCatalogImageApprovalTarget(
        result,
        enableCatalogImageApproval,
      );
      const payload: PhotoIdentificationCreateInput = {
        pendingImageId: result.pendingImage.id,
        ...(catalogImageApproved && catalogImageApprovalTarget
          ? { catalogImageApproval: { target: catalogImageApprovalTarget } }
          : {}),
      };
      const created =
        await photoIdentificationCreateMutation.mutateAsync(payload);
      await resolveTarget({
        bottle: created.bottle,
        release: created.release,
        hasExactLibraryEntry: false,
        warnings: (created.warnings ?? []).map(
          (warning) =>
            warning.message ||
            "The bottle was created, but the public image was not saved.",
        ),
      });
    } catch (err) {
      if (isORPCUnauthorizedRedirectError(err)) return;

      logError(err);
      setError(
        "We couldn't create that bottle from the photo. Search for the bottle to keep going.",
      );
    }
  }

  async function identifyPhoto(file: File) {
    setError(null);
    setPhotoError(null);
    setPhotoResult(null);
    setCatalogImageApproved(false);

    const nextPreviewUrl = URL.createObjectURL(file);
    replacePreviewUrl(nextPreviewUrl);

    try {
      const result = await photoIdentificationMutation.mutateAsync({
        file,
        idempotencyKey: createIdempotencyKey(),
      });
      setPhotoResult(result);
    } catch (err) {
      if (isORPCUnauthorizedRedirectError(err)) return;

      logError(err, {
        context: "add_tasting_photo_identification",
        rpc: "tastings.photoIdentification",
        file: {
          size: file.size,
          type: file.type || null,
        },
      });
      setPhotoError(
        "We couldn't read that photo. Search can still find the bottle, or you can try another photo.",
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
    setPhotoError(null);
    setPhotoResult(null);
    setCatalogImageApproved(false);
    setMatchedBottleStatus(null);
    replacePreviewUrl(null);
  }

  const matchedBottleId = getMatchedBottleId(photoResult);
  const matchedReleaseId = getMatchedReleaseId(photoResult);
  const createDecision = getCreateDecision(photoResult);
  const proposedName = getProposedName(photoResult);
  const createProposalLabel = getCreateProposalLabel(photoResult);
  const catalogImageApprovalTarget = photoResult
    ? getAllowedCatalogImageApprovalTarget(
        photoResult,
        enableCatalogImageApproval,
      )
    : null;
  const catalogImageApprovalCopy = catalogImageApprovalTarget
    ? getCatalogImageApprovalCopy(catalogImageApprovalTarget)
    : null;
  const defaultSearchHref = searchHrefForQuery();
  const searchSeed = getSearchSeed(photoResult);
  const searchHref = searchHrefForQuery(searchSeed);
  const createBottlePrefill = getCreateBottlePrefill(photoResult);
  const createBottleHref =
    photoResult && createBottleHrefForResult
      ? createBottleHrefForResult(
          getCreateNameSeed(photoResult),
          createBottlePrefill,
        )
      : null;
  const manualResultCopy = getManualResultCopy(photoResult);
  const matchedBottleHasExactLibraryEntry =
    matchedBottleStatus?.bottleId === matchedBottleId &&
    matchedBottleStatus.releaseId === matchedReleaseId
      ? matchedBottleStatus.hasExactLibraryEntry
      : false;
  const matchedBottleExactLibraryStatusLoading =
    Boolean(matchedBottleId) &&
    (matchedBottleStatus?.bottleId !== matchedBottleId ||
      matchedBottleStatus?.releaseId !== matchedReleaseId ||
      matchedBottleStatus.loading);

  useEffect(() => {
    if (!matchedBottleId) {
      setMatchedBottleStatus(null);
      return;
    }

    const statusBottleId = matchedBottleId;
    const statusReleaseId = matchedReleaseId;
    let cancelled = false;
    setMatchedBottleStatus({
      bottleId: statusBottleId,
      releaseId: statusReleaseId,
      hasExactLibraryEntry: false,
      loading: true,
    });

    async function loadMatchedBottleStatus() {
      try {
        const collectionStatus = await orpc.collections.bottles.list.call({
          user: "me",
          collection: "library",
          bottle: statusBottleId,
          release: statusReleaseId ?? undefined,
          baseOnly: statusReleaseId == null,
        });
        if (cancelled) return;
        setMatchedBottleStatus({
          bottleId: statusBottleId,
          releaseId: statusReleaseId,
          hasExactLibraryEntry: collectionStatus.results.length > 0,
          loading: false,
        });
      } catch (err) {
        logError(err);
        if (cancelled) return;
        setMatchedBottleStatus({
          bottleId: statusBottleId,
          releaseId: statusReleaseId,
          hasExactLibraryEntry: false,
          loading: false,
        });
      }
    }

    void loadMatchedBottleStatus();

    return () => {
      cancelled = true;
    };
  }, [matchedBottleId, matchedReleaseId, orpc]);

  return (
    <Layout
      footer={null}
      header={
        <Header>
          <div className="flex w-full items-center gap-3">
            <button
              type="button"
              aria-label="Back"
              className="text-muted group flex justify-center lg:hidden"
              onClick={() => router.back()}
            >
              <div className="-my-1 rounded bg-slate-800 p-1 group-hover:bg-slate-700 group-hover:text-white">
                <ChevronLeft className="h-8 w-8" />
              </div>
            </button>
            <h1 className="text-2xl font-bold">{title}</h1>
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
            <SearchBottleCallout searchHref={defaultSearchHref} />
          </>
        )}

        {!isIdentifying && previewUrl && !photoResult && photoError && (
          <PhotoFailurePanel
            previewUrl={previewUrl}
            title="We couldn't read that photo"
            description={photoError}
            searchHref={defaultSearchHref}
            searchLabel={searchActionLabel}
            createBottleHref={createBottleHrefForResult?.("") ?? null}
            onStartOver={startOver}
            variant="error"
          />
        )}

        {isIdentifying && (
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
                    href={defaultSearchHref}
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
                    <ResultHeader
                      previewUrl={previewUrl}
                      icon={
                        <div className="bg-highlight rounded-full p-2 text-black">
                          <Check className="h-5 w-5" />
                        </div>
                      }
                      title="Match found"
                      description={matchedResultDescription}
                    >
                      <EvidencePills result={photoResult} />
                    </ResultHeader>
                  ) : createDecision ? (
                    <ResultHeader
                      previewUrl={previewUrl}
                      icon={
                        <div className="bg-highlight rounded-full p-2 text-black">
                          <Plus className="h-5 w-5" />
                        </div>
                      }
                      title={createProposalLabel?.title ?? "New bottle found"}
                      description={
                        createProposalLabel?.description ??
                        "Create the bottle from this label."
                      }
                    >
                      <EvidencePills result={photoResult} />
                    </ResultHeader>
                  ) : (
                    <PhotoFailurePanel
                      previewUrl={previewUrl}
                      title={manualResultCopy.title}
                      description={manualResultCopy.description}
                      searchHref={searchHref}
                      searchLabel={searchActionLabel}
                      createBottleHref={
                        manualResultCopy.createLabel ? createBottleHref : null
                      }
                      createBottleLabel={manualResultCopy.createLabel}
                      primaryAction={manualResultCopy.primaryAction}
                      onStartOver={startOver}
                      variant="no-match"
                    >
                      <EvidencePills result={photoResult} />
                    </PhotoFailurePanel>
                  )}

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
                    </div>
                  )}
                  {createDecision && catalogImageApprovalCopy && (
                    <label className="flex items-start gap-3 rounded border border-slate-800 bg-slate-950 p-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={catalogImageApproved}
                        disabled={photoIdentificationCreateMutation.isPending}
                        onChange={(event) =>
                          setCatalogImageApproved(event.target.checked)
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 font-semibold text-white">
                          <ImageIcon className="h-4 w-4" />
                          {catalogImageApprovalCopy.label}
                        </span>
                        <span className="text-muted mt-1 block text-sm">
                          {catalogImageApprovalCopy.help}
                        </span>
                      </span>
                    </label>
                  )}
                </div>
                {matchedBottleId || createDecision ? (
                  <div
                    className={`mx-auto grid w-full gap-2 ${
                      matchedBottleId && renderMatchedResultActions
                        ? ""
                        : "sm:w-1/2"
                    }`}
                  >
                    {matchedBottleId &&
                      (renderMatchedResultActions ? (
                        renderMatchedResultActions({
                          bottleId: matchedBottleId,
                          releaseId: matchedReleaseId,
                          hasExactLibraryEntry:
                            matchedBottleHasExactLibraryEntry,
                          loadingExactLibraryStatus:
                            matchedBottleExactLibraryStatusLoading,
                          resolvingAction,
                          onResolve: (action) => {
                            void loadTarget(
                              matchedBottleId,
                              matchedReleaseId,
                              action,
                            );
                          },
                        })
                      ) : (
                        <Button
                          color="highlight"
                          fullWidth
                          disabled={Boolean(resolvingAction)}
                          onClick={() =>
                            void loadTarget(matchedBottleId, matchedReleaseId)
                          }
                        >
                          Continue
                        </Button>
                      ))}
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
                          : createProposalActionLabel}
                      </Button>
                    )}
                  </div>
                ) : null}
              </div>
            </section>
            {(matchedBottleId || createDecision) && (
              <FallbackActions
                searchHref={searchHref}
                searchLabel={searchActionLabel}
                showStartOver
                onStartOver={startOver}
              />
            )}
          </>
        )}

        {error && <FormError values={[error]} />}

        <style jsx global>{`
          @keyframes bottle-resolver-loading-shimmer {
            0% {
              background-position: 200% 0;
            }
            100% {
              background-position: -200% 0;
            }
          }

          .bottle-resolver-loading-shimmer {
            animation: bottle-resolver-loading-shimmer 2.4s ease-in-out infinite;
          }
        `}</style>
      </div>
    </Layout>
  );
}
