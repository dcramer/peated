"use client";

import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import type { Outputs } from "@peated/server/orpc/router";
import Button from "@peated/web/components/button";
import { useFlashMessages } from "@peated/web/components/flash";
import Link from "@peated/web/components/link";
import classNames from "@peated/web/lib/classNames";
import { copyTextToClipboard } from "@peated/web/lib/clipboard";
import { type ReactNode, useState } from "react";
import LinkedBottleChecks from "./linkedBottleChecks";
import { formatPriceMatchQueueLlmExport } from "./llmExport";

export type QueueItem =
  Outputs["prices"]["matchQueue"]["list"]["results"][number];
type Candidate = QueueItem["candidateBottles"][number];
type RecommendationField = {
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
};
type RepairChange = {
  label: string;
  current: string;
  proposed: string;
};
type RecommendationBottle = {
  fullName?: string;
  brand: { id: number | null; name: string };
  name: string;
  series: { id: number | null; name: string } | null;
  category: string | null;
  edition: string | null;
  statedAge: number | null;
  abv: number | null;
  caskStrength: boolean | null;
  singleCask: boolean | null;
  vintageYear: number | null;
  releaseYear: number | null;
  caskType: string | null;
  caskSize: string | null;
  caskFill: string | null;
  distillers: Array<{ id: number | null; name: string }>;
  bottler: { id: number | null; name: string } | null;
};
type CurrentBottle = NonNullable<QueueItem["currentBottle"]>;
type BottleReference = Pick<CurrentBottle, "id">;
type RepairProposalItem = Pick<QueueItem, "proposalType" | "proposedBottle"> & {
  currentBottle: BottleReference | null;
  suggestedBottle: BottleReference | null;
};
type SuggestedBottleDecision = RepairProposalItem &
  Pick<QueueItem, "status" | "isProcessing">;
type RepairBottle = Pick<
  CurrentBottle,
  | "name"
  | "category"
  | "edition"
  | "statedAge"
  | "abv"
  | "caskStrength"
  | "singleCask"
  | "vintageYear"
  | "releaseYear"
  | "caskType"
  | "caskSize"
  | "caskFill"
> & {
  brand: Pick<CurrentBottle["brand"], "id">;
  series: Pick<NonNullable<CurrentBottle["series"]>, "id"> | null;
  distillers: Array<Pick<CurrentBottle["distillers"][number], "id">>;
  bottler: Pick<NonNullable<CurrentBottle["bottler"]>, "id"> | null;
};
type QueueItemCardProps = {
  isBusy: boolean;
  item: QueueItem;
  returnTo: string;
  onApproveMatch: (item: QueueItem) => Promise<void>;
  onApplyCreateProposal: (item: QueueItem) => Promise<void>;
  onApplyBottleRepair: (item: QueueItem) => Promise<void>;
  onChooseBottle: (item: QueueItem) => void;
  onIgnore: (item: QueueItem) => Promise<void>;
  onRetry: (item: QueueItem) => Promise<void>;
};

function getDecisionLabel(item: QueueItem): string {
  if (item.status === "errored") {
    return "Errored";
  }

  switch (item.proposalType) {
    case "create_new":
      return "Create New";
    case "match_existing":
      return "Match Existing";
    case "correction":
      return "Correction";
    default:
      return "No Match";
  }
}

function getDecisionBadgeClassName(item: QueueItem): string {
  if (item.status === "errored") {
    return "border-red-800 bg-red-950/70 text-red-200";
  }

  switch (item.proposalType) {
    case "create_new":
      return "border-highlight/40 bg-highlight/10 text-highlight";
    case "match_existing":
      return "border-emerald-800 bg-emerald-950/60 text-emerald-200";
    case "correction":
      return "border-amber-800 bg-amber-950/60 text-amber-200";
    default:
      return "border-slate-700 bg-slate-900 text-slate-200";
  }
}

function formatConfidence(item: QueueItem): string {
  if (item.status === "errored") {
    return "n/a";
  }

  return item.modelConfidence === null ? "?" : `${item.modelConfidence}`;
}

function formatAutomationScore(item: QueueItem): string {
  if (item.status === "errored" || item.proposalType === "no_match") {
    return "n/a";
  }

  return item.automationScore === null ? "?" : `${item.automationScore}`;
}

function getEvidenceBadges(item: QueueItem): string[] {
  const badges: string[] = [];

  if (item.status === "errored") {
    badges.push("evaluation error");
  } else if (item.searchEvidence.length > 0) {
    badges.push("web validated");
  } else {
    badges.push("local only");
  }

  if (item.candidateBottles.length > 0) {
    badges.push(
      `${item.candidateBottles.length} local candidate${item.candidateBottles.length === 1 ? "" : "s"}`,
    );
  }

  if (item.automationEligible) {
    badges.push("automation ready");
  }

  if (isRepairProposal(item)) {
    badges.push("repair draft");
  } else if (item.currentBottle && item.proposalType === "correction") {
    badges.push("current assignment differs");
  }

  return badges;
}

function getExtractedLabelSummary(item: QueueItem): string[] {
  const extractedLabel = item.extractedLabel;
  if (!extractedLabel) {
    return [];
  }

  const summary: string[] = [];

  if (extractedLabel.brand) {
    summary.push(`brand: ${extractedLabel.brand}`);
  }
  if (extractedLabel.bottler) {
    summary.push(`bottler: ${extractedLabel.bottler}`);
  }
  if (extractedLabel.expression) {
    summary.push(`expression: ${extractedLabel.expression}`);
  }
  if (extractedLabel.series) {
    summary.push(`series: ${extractedLabel.series}`);
  }
  if (extractedLabel.stated_age !== null) {
    summary.push(`age: ${extractedLabel.stated_age}`);
  }
  if (extractedLabel.edition) {
    summary.push(`edition: ${extractedLabel.edition}`);
  }
  if (extractedLabel.cask_type) {
    summary.push(`cask: ${extractedLabel.cask_type}`);
  }
  if (extractedLabel.cask_size) {
    summary.push(`cask size: ${extractedLabel.cask_size}`);
  }
  if (extractedLabel.cask_fill) {
    summary.push(`cask fill: ${extractedLabel.cask_fill}`);
  }
  if (extractedLabel.distillery?.length) {
    summary.push(`distillery: ${extractedLabel.distillery.join(", ")}`);
  }

  return summary;
}

function getRecommendationHeading(item: QueueItem): string {
  if (item.status === "errored") {
    return "Review Status";
  }

  if (isRepairProposal(item)) {
    return "Recommended Repair";
  }

  return "Recommended Outcome";
}

function getCandidateScoreLabel(candidate: Candidate): string | null {
  if (candidate.score === null) {
    return null;
  }

  return `${candidate.score.toFixed(2)} score`;
}

function getTopCandidates(item: QueueItem): Candidate[] {
  return item.candidateBottles.slice(0, 3);
}

function formatTimestamp(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatAbv(value: number | null): string | null {
  return value === null ? null : `${value}%`;
}

function formatAge(value: number | null): string | null {
  return value === null ? null : `${value} years`;
}

function formatFlag(value: boolean | null): string | null {
  if (value === null) {
    return null;
  }

  return value ? "Yes" : "No";
}

function formatRepairValue(value: string | null): string {
  return value ?? "unknown";
}

function formatExistingBottleValue(hasValue: boolean): string | null {
  return hasValue ? "Existing Bottle value" : null;
}

export function isRepairProposal(item: RepairProposalItem): boolean {
  return (
    item.proposalType === "correction" &&
    item.currentBottle !== null &&
    item.suggestedBottle !== null &&
    item.currentBottle.id === item.suggestedBottle.id &&
    !!item.proposedBottle
  );
}

export function canApproveSuggestedBottle(
  item: SuggestedBottleDecision,
): boolean {
  return (
    item.status === "pending_review" &&
    item.suggestedBottle !== null &&
    !isRepairProposal(item) &&
    !item.isProcessing
  );
}

export function isPrimaryDecisionComplete(
  item: Pick<QueueItem, "status">,
): boolean {
  return ["approved", "ignored", "verified"].includes(item.status);
}

function getChoiceName(
  choice: number | { name?: string | null } | null | undefined,
): string | null {
  return typeof choice === "object" && choice?.name ? choice.name : null;
}

function getConcreteBottleDraftFields(
  bottle: NonNullable<QueueItem["proposedBottle"]>,
): RecommendationField[] {
  const fields: RecommendationField[] = [
    {
      label: "Brand",
      value: getChoiceName(bottle.brand) ?? "Selected brand",
    },
    {
      label: "Bottle Name",
      value: bottle.name ?? "Not specified",
    },
  ];

  const seriesName = getChoiceName(bottle.series);
  if (seriesName) {
    fields.push({
      label: "Series",
      value: seriesName,
    });
  }

  if (bottle.statedAge !== null && bottle.statedAge !== undefined) {
    fields.push({
      label: "Age",
      value: formatAge(bottle.statedAge),
    });
  }

  if (bottle.category) {
    fields.push({
      label: "Category",
      value: bottle.category,
    });
  }

  const distillerNames =
    bottle.distillers?.map(getChoiceName).filter((name) => name !== null) ?? [];
  if (distillerNames.length > 0) {
    fields.push({
      label: "Distillery",
      value: distillerNames.join(", "),
      fullWidth: true,
    });
  }

  const bottlerName = getChoiceName(bottle.bottler);
  if (bottlerName) {
    fields.push({
      label: "Bottler",
      value: bottlerName,
      fullWidth: true,
    });
  }
  const caskDetails = [
    bottle.caskType,
    bottle.caskFill,
    bottle.caskSize,
  ].filter(Boolean);

  if (bottle.edition) {
    fields.push({
      label: "Edition",
      value: bottle.edition,
    });
  }

  if (bottle.abv !== null && bottle.abv !== undefined) {
    fields.push({
      label: "ABV",
      value: formatAbv(bottle.abv),
    });
  }

  if (bottle.releaseYear !== null && bottle.releaseYear !== undefined) {
    fields.push({
      label: "Release Year",
      value: bottle.releaseYear,
    });
  }

  if (bottle.vintageYear !== null && bottle.vintageYear !== undefined) {
    fields.push({
      label: "Vintage Year",
      value: bottle.vintageYear,
    });
  }

  if (bottle.caskStrength) {
    fields.push({
      label: "Strength",
      value: "Cask strength",
    });
  }

  if (bottle.singleCask) {
    fields.push({
      label: "Cask Source",
      value: "Single cask",
    });
  }

  if (caskDetails.length > 0) {
    fields.push({
      label: "Cask Details",
      value: caskDetails.join(" / "),
      fullWidth: true,
    });
  }

  return fields;
}

export function getBottleRepairChanges(
  currentBottle: RepairBottle,
  proposedBottle: RecommendationBottle,
): RepairChange[] {
  const changes: RepairChange[] = [];
  const pushChange = (
    label: string,
    current: string | null,
    proposed: string | null,
    include = true,
  ) => {
    if (!include) {
      return;
    }

    if ((current ?? null) === (proposed ?? null)) {
      return;
    }

    changes.push({
      label,
      current: formatRepairValue(current),
      proposed: formatRepairValue(proposed),
    });
  };

  if (currentBottle.brand.id !== proposedBottle.brand.id) {
    pushChange(
      "Brand",
      formatExistingBottleValue(true),
      proposedBottle.brand.name,
    );
  }
  pushChange("Bottle Name", currentBottle.name, proposedBottle.name);
  if (
    proposedBottle.series !== null &&
    currentBottle.series?.id !== proposedBottle.series.id
  ) {
    pushChange(
      "Series",
      formatExistingBottleValue(currentBottle.series !== null),
      proposedBottle.series.name,
    );
  }
  pushChange(
    "Category",
    currentBottle.category,
    proposedBottle.category,
    proposedBottle.category !== null,
  );
  if (
    proposedBottle.distillers.length > 0 &&
    currentBottle.distillers.map((distiller) => distiller.id).join(",") !==
      proposedBottle.distillers.map((distiller) => distiller.id).join(",")
  ) {
    pushChange(
      "Distillery",
      formatExistingBottleValue(currentBottle.distillers.length > 0),
      proposedBottle.distillers.map((distiller) => distiller.name).join(", "),
    );
  }
  if (
    proposedBottle.bottler !== null &&
    currentBottle.bottler?.id !== proposedBottle.bottler.id
  ) {
    pushChange(
      "Bottler",
      formatExistingBottleValue(currentBottle.bottler !== null),
      proposedBottle.bottler.name,
    );
  }
  pushChange(
    "Age",
    formatAge(currentBottle.statedAge),
    formatAge(proposedBottle.statedAge),
    proposedBottle.statedAge !== null,
  );
  pushChange(
    "Edition",
    currentBottle.edition,
    proposedBottle.edition,
    proposedBottle.edition !== null,
  );
  pushChange(
    "ABV",
    formatAbv(currentBottle.abv),
    formatAbv(proposedBottle.abv),
    proposedBottle.abv !== null,
  );
  pushChange(
    "Cask Strength",
    formatFlag(currentBottle.caskStrength),
    formatFlag(proposedBottle.caskStrength),
    proposedBottle.caskStrength !== null,
  );
  pushChange(
    "Single Cask",
    formatFlag(currentBottle.singleCask),
    formatFlag(proposedBottle.singleCask),
    proposedBottle.singleCask !== null,
  );
  pushChange(
    "Cask",
    currentBottle.caskType,
    proposedBottle.caskType,
    proposedBottle.caskType !== null,
  );
  pushChange(
    "Cask Size",
    currentBottle.caskSize,
    proposedBottle.caskSize,
    proposedBottle.caskSize !== null,
  );
  pushChange(
    "Cask Fill",
    currentBottle.caskFill,
    proposedBottle.caskFill,
    proposedBottle.caskFill !== null,
  );
  pushChange(
    "Vintage Year",
    currentBottle.vintageYear?.toString() ?? null,
    proposedBottle.vintageYear?.toString() ?? null,
    proposedBottle.vintageYear !== null,
  );
  pushChange(
    "Release Year",
    currentBottle.releaseYear?.toString() ?? null,
    proposedBottle.releaseYear?.toString() ?? null,
    proposedBottle.releaseYear !== null,
  );

  return changes;
}

function RecommendationSection({
  label,
  title,
  href,
  fields,
  placeholder = "Not specified",
}: {
  label: string;
  title: string | null;
  href?: string;
  fields: RecommendationField[];
  placeholder?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <div className="text-muted text-[11px] font-semibold uppercase tracking-wide">
        {label}
      </div>
      {title ? (
        href ? (
          <Link
            href={href}
            className="mt-1 inline-block text-sm font-semibold text-white underline"
          >
            {title}
          </Link>
        ) : (
          <div className="mt-1 text-sm font-semibold text-white">{title}</div>
        )
      ) : (
        <div className="mt-1 text-sm text-slate-300">{placeholder}</div>
      )}
      {fields.length > 0 ? (
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          {fields.map((field) => (
            <div
              key={`${label}-${field.label}`}
              className={field.fullWidth ? "col-span-2" : undefined}
            >
              <dt className="text-muted text-xs uppercase tracking-wide">
                {field.label}
              </dt>
              <dd className="mt-1 text-slate-100">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function BottleIdentitySection({
  label,
  bottle,
  placeholder,
}: {
  label: string;
  bottle: QueueItem["currentBottle"];
  placeholder: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <div className="text-muted text-[11px] font-semibold uppercase tracking-wide">
        {label}
      </div>
      {bottle ? (
        <div className="mt-1 text-sm text-white">
          <Link
            href={`/bottles/${bottle.id}`}
            className="font-semibold underline"
          >
            {bottle.fullName}
          </Link>
        </div>
      ) : (
        <div className="mt-1 text-sm text-slate-300">{placeholder}</div>
      )}
    </div>
  );
}

function renderRecommendationOutcome(item: QueueItem): ReactNode {
  if (item.status === "errored") {
    return (
      <div className="mt-2 text-sm text-slate-300">
        No recommendation available.
      </div>
    );
  }

  if (item.proposalType === "no_match") {
    return (
      <div className="mt-2 text-sm text-slate-300">
        No safe existing match or create draft was recommended. Use Choose
        Bottle to resolve it manually.
      </div>
    );
  }

  const repairChanges =
    isRepairProposal(item) && item.currentBottle && item.proposedBottle
      ? getBottleRepairChanges(item.currentBottle, item.proposedBottle)
      : [];

  if (isRepairProposal(item) && item.currentBottle && item.proposedBottle) {
    return (
      <div className="mt-3 space-y-3">
        <BottleIdentitySection
          label="Existing Bottle"
          bottle={item.currentBottle}
          placeholder="No bottle identified"
        />

        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <div className="text-muted text-[11px] font-semibold uppercase tracking-wide">
            Proposed Changes
          </div>
          {repairChanges.length > 0 ? (
            <dl className="mt-3 space-y-3 text-sm">
              {repairChanges.map((change) => (
                <div key={`repair-${change.label}`}>
                  <dt className="text-muted text-xs uppercase tracking-wide">
                    {change.label}
                  </dt>
                  <dd className="mt-1 text-slate-100">
                    <span className="text-slate-400">{change.current}</span>
                    {" -> "}
                    <span>{change.proposed}</span>
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="mt-1 text-sm text-slate-300">
              No bottle field changes were captured.
            </div>
          )}
        </div>

        <div className="text-xs text-slate-400">
          Applying this draft updates the existing bottle and approves the
          listing match together.
        </div>
      </div>
    );
  }

  if (item.suggestedBottle) {
    return (
      <div className="mt-3">
        <BottleIdentitySection
          label="Suggested Assignment"
          bottle={item.suggestedBottle}
          placeholder="No safe existing Bottle suggested"
        />
      </div>
    );
  }

  if (!item.proposedBottle) {
    return (
      <div className="mt-2 text-sm text-slate-300">
        No safe existing Bottle suggested.
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <RecommendationSection
        label="Bottle Draft"
        title={item.price.name}
        fields={getConcreteBottleDraftFields(item.proposedBottle)}
      />
    </div>
  );
}

function formatAttributeName(
  attribute: QueueItem["webEvidenceChecks"][number]["attribute"],
) {
  switch (attribute) {
    case "bottler":
      return "Bottler";
    case "statedAge":
      return "Age";
    case "caskType":
      return "Cask";
    case "caskSize":
      return "Cask Size";
    case "caskFill":
      return "Cask Fill";
    case "caskStrength":
      return "Cask Strength";
    case "singleCask":
      return "Single Cask";
    case "vintageYear":
      return "Vintage Year";
    case "releaseYear":
      return "Release Year";
    default:
      return attribute.charAt(0).toUpperCase() + attribute.slice(1);
  }
}

function formatSourceTier(
  tier: QueueItem["webEvidenceChecks"][number]["matchedSourceTiers"][number],
) {
  switch (tier) {
    case "origin_retailer":
      return "origin retailer";
    default:
      return tier;
  }
}

type CreateProposalActions = {
  applyLabel: string;
  editHref: string;
  editLabel: string;
};

function getCreateProposalActions(
  item: QueueItem,
  returnTo: string,
): CreateProposalActions | null {
  if (!item.proposedBottle) {
    return null;
  }

  const queryString = `proposal=${item.id}&returnTo=${encodeURIComponent(returnTo)}`;

  return {
    applyLabel: "Apply Bottle Draft",
    editLabel: "Edit Bottle Draft",
    editHref: `/bottles/new?${queryString}`,
  };
}

export default function QueueItemCard({
  isBusy,
  item,
  returnTo,
  onApproveMatch,
  onApplyBottleRepair,
  onApplyCreateProposal,
  onChooseBottle,
  onIgnore,
  onRetry,
}: QueueItemCardProps) {
  const { flash } = useFlashMessages();
  const [isCopying, setIsCopying] = useState(false);
  const evidenceBadges = getEvidenceBadges(item);
  const extractedLabelSummary = getExtractedLabelSummary(item);
  const topCandidates = getTopCandidates(item);
  const repairProposal = isRepairProposal(item);
  const isProcessing = item.isProcessing;
  const canApproveMatch = canApproveSuggestedBottle(item);
  const primaryDecisionComplete = isPrimaryDecisionComplete(item);
  const canCreateBottle =
    item.status === "pending_review" &&
    item.proposalType === "create_new" &&
    !!item.proposedBottle &&
    !isProcessing;
  const canApplyRepair = item.status === "pending_review" && repairProposal;
  const createProposalActions = getCreateProposalActions(item, returnTo);
  const repairEditHref =
    repairProposal && item.currentBottle
      ? `/bottles/${item.currentBottle.id}/edit`
      : null;
  const queuedAt = formatTimestamp(item.createdAt);
  const processingQueuedAt = formatTimestamp(item.processingQueuedAt);
  const processingExpiresAt = formatTimestamp(item.processingExpiresAt);

  async function handleCopyForLlm(): Promise<void> {
    setIsCopying(true);

    try {
      await copyTextToClipboard(formatPriceMatchQueueLlmExport(item));
      flash(
        <div>
          Copied structured match payload for{" "}
          <strong className="font-bold">{item.price.name}</strong>
        </div>,
      );
    } catch {
      flash(
        <div>
          Unable to copy the match payload for{" "}
          <strong className="font-bold">{item.price.name}</strong>
        </div>,
      );
    } finally {
      setIsCopying(false);
    }
  }

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 shadow-sm lg:p-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1.2fr)_220px]">
        <section className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-base font-semibold text-white lg:text-lg">
                {item.price.name}
              </div>
              <div className="text-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <Link
                  href={item.price.url}
                  target="_blank"
                  className="underline"
                >
                  {item.price.site.name}
                </Link>
                {item.price.volume ? <span>{item.price.volume}mL</span> : null}
                {queuedAt ? <span>Queued {queuedAt}</span> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {isProcessing ? (
                <span className="rounded-full border border-sky-800 bg-sky-950/60 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-sky-200">
                  Processing
                </span>
              ) : null}
              <span
                className={classNames(
                  "rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide",
                  getDecisionBadgeClassName(item),
                )}
              >
                {getDecisionLabel(item)}
              </span>
              <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200">
                Model {formatConfidence(item)}
              </span>
              <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200">
                Automation {formatAutomationScore(item)}
              </span>
            </div>
          </div>

          {isProcessing ? (
            <div className="rounded-lg border border-sky-900/70 bg-sky-950/30 p-3 text-sm text-sky-100">
              <div className="text-xs font-semibold uppercase tracking-wide text-sky-200">
                Retry Processing
              </div>
              <div className="mt-2 space-y-1">
                {processingQueuedAt ? (
                  <div>Queued: {processingQueuedAt}</div>
                ) : null}
                {processingExpiresAt ? (
                  <div>Lease expires: {processingExpiresAt}</div>
                ) : null}
              </div>
            </div>
          ) : null}

          <BottleIdentitySection
            label="Current Assignment"
            bottle={item.currentBottle}
            placeholder="No Bottle assigned"
          />

          {extractedLabelSummary.length > 0 ? (
            <div className="space-y-2">
              <div className="text-muted text-xs font-semibold uppercase tracking-wide">
                Extracted Identity
              </div>
              <div className="flex flex-wrap gap-2">
                {extractedLabelSummary.map((part) => (
                  <span
                    key={part}
                    className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-200"
                  >
                    {part}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {topCandidates.length > 0 ? (
            <div className="space-y-2">
              <div className="text-muted text-xs font-semibold uppercase tracking-wide">
                Closest Local Candidates
              </div>
              <div className="space-y-2">
                {topCandidates.map((candidate) => (
                  <div
                    key={`${item.id}-${candidate.bottleId}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/bottles/${candidate.bottleId}`}
                        className="font-semibold text-white underline"
                      >
                        {candidate.fullName}
                      </Link>
                      {candidate.alias ? (
                        <div className="text-muted text-xs">
                          alias: {candidate.alias}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-muted flex flex-wrap gap-2 text-xs">
                      {candidate.source.map((source) => (
                        <span
                          key={`${candidate.bottleId}-${source}`}
                          className="rounded-full border border-slate-700 px-2 py-0.5"
                        >
                          {source}
                        </span>
                      ))}
                      {getCandidateScoreLabel(candidate) ? (
                        <span>{getCandidateScoreLabel(candidate)}</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-muted text-xs font-semibold uppercase tracking-wide">
              {getRecommendationHeading(item)}
            </div>
            {renderRecommendationOutcome(item)}
          </div>

          <div className="flex flex-wrap gap-2">
            {evidenceBadges.map((badge) => (
              <span
                key={`${item.id}-${badge}`}
                className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-200"
              >
                {badge}
              </span>
            ))}
          </div>

          {item.automationBlockers.length > 0 ? (
            <div className="rounded-lg border border-amber-900/70 bg-amber-950/30 p-3 text-sm text-amber-100">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-200">
                Automation Blockers
              </div>
              <div className="mt-2 space-y-1">
                {item.automationBlockers.map((blocker) => (
                  <div key={`${item.id}-${blocker}`}>{blocker}</div>
                ))}
              </div>
            </div>
          ) : null}

          <details className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm">
            <summary className="cursor-pointer list-none font-semibold text-white">
              Review evidence
            </summary>
            <div className="mt-3 space-y-3">
              {item.status === "errored" && item.error ? (
                <div>
                  <div className="text-muted text-xs font-semibold uppercase tracking-wide">
                    Error
                  </div>
                  <div className="mt-1 text-red-200">{item.error}</div>
                </div>
              ) : null}

              {item.rationale ? (
                <div>
                  <div className="text-muted text-xs font-semibold uppercase tracking-wide">
                    Rationale
                  </div>
                  <div className="mt-1 text-slate-200">{item.rationale}</div>
                </div>
              ) : null}

              {item.decisiveMatchAttributes.length > 0 ||
              item.differentiatingAttributes.length > 0 ? (
                <div className="space-y-2">
                  {item.decisiveMatchAttributes.length > 0 ? (
                    <div>
                      <div className="text-muted text-xs font-semibold uppercase tracking-wide">
                        Decisive Match Traits
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {item.decisiveMatchAttributes.map((attribute) => (
                          <span
                            key={`${item.id}-decisive-${attribute}`}
                            className="rounded-full border border-emerald-800 bg-emerald-950/60 px-2.5 py-1 text-xs text-emerald-100"
                          >
                            {formatAttributeName(attribute)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {item.differentiatingAttributes.length > 0 ? (
                    <div>
                      <div className="text-muted text-xs font-semibold uppercase tracking-wide">
                        Traits Requiring Validation
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {item.differentiatingAttributes.map((attribute) => (
                          <span
                            key={`${item.id}-diff-${attribute}`}
                            className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-200"
                          >
                            {formatAttributeName(attribute)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {item.webEvidenceChecks.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-muted text-xs font-semibold uppercase tracking-wide">
                    Evidence Checks
                  </div>
                  {item.webEvidenceChecks.map((check) => (
                    <div
                      key={`${item.id}-${check.attribute}-${check.expectedValue}`}
                      className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium text-slate-100">
                          {formatAttributeName(check.attribute)}:{" "}
                          {check.expectedValue}
                        </div>
                        <div className="text-xs text-slate-300">
                          {check.validated
                            ? "authoritatively validated"
                            : check.weaklySupported
                              ? "retailer or weak support only"
                              : "not validated"}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
                        {check.required ? (
                          <span className="rounded-full border border-slate-700 px-2 py-0.5">
                            required
                          </span>
                        ) : null}
                        {check.matchedSourceTiers.map((tier) => (
                          <span
                            key={`${item.id}-${check.attribute}-${check.expectedValue}-${tier}`}
                            className="rounded-full border border-slate-700 px-2 py-0.5"
                          >
                            {formatSourceTier(tier)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {item.searchEvidence.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-muted text-xs font-semibold uppercase tracking-wide">
                    Web evidence
                  </div>
                  {item.searchEvidence.map((evidence) => (
                    <div
                      key={`${item.id}-${evidence.query}`}
                      className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
                    >
                      <div className="font-medium text-slate-100">
                        {evidence.query}
                      </div>
                      {evidence.summary ? (
                        <div className="mt-2 text-sm text-slate-300">
                          {evidence.summary}
                        </div>
                      ) : null}
                      <div className="mt-2 space-y-1">
                        {evidence.results.slice(0, 3).map((result) => (
                          <div key={result.url} className="text-sm">
                            <Link
                              href={result.url}
                              target="_blank"
                              className="underline"
                            >
                              {result.title}
                            </Link>
                            {result.domain ? (
                              <div className="text-xs text-slate-400">
                                {result.domain}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted">
                  No web evidence captured for this proposal.
                </div>
              )}
            </div>
          </details>
        </section>

        <aside className="flex flex-col gap-2">
          <Button
            className="self-end"
            icon={
              <DocumentDuplicateIcon className="h-5 w-5" aria-hidden="true" />
            }
            size="small"
            disabled={isCopying}
            loading={isCopying}
            onClick={async () => {
              await handleCopyForLlm();
            }}
            title="Copy structured listing, identity, evidence, and recommendation data as JSON"
          >
            <span className="sr-only">Copy match payload</span>
          </Button>

          {isProcessing ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-3 text-sm text-slate-300">
              Retry lease is active. Review actions return when the retry
              finishes or the lease expires.
            </div>
          ) : primaryDecisionComplete ? (
            <div className="rounded-lg border border-emerald-900 bg-emerald-950/30 px-3 py-3 text-sm text-emerald-100">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
                Primary decision complete
              </div>
              <div className="mt-2">Supplemental audit work remains below.</div>
            </div>
          ) : (
            <>
              {canApproveMatch ? (
                <Button
                  color="highlight"
                  fullWidth
                  disabled={isBusy}
                  onClick={async () => {
                    await onApproveMatch(item);
                  }}
                >
                  Approve Match
                </Button>
              ) : null}

              {canCreateBottle ? (
                <Button
                  color="highlight"
                  fullWidth
                  disabled={isBusy}
                  onClick={async () => {
                    await onApplyCreateProposal(item);
                  }}
                >
                  {createProposalActions?.applyLabel ?? "Apply Draft"}
                </Button>
              ) : null}

              {canCreateBottle && createProposalActions ? (
                <Button href={createProposalActions.editHref} fullWidth>
                  {createProposalActions.editLabel}
                </Button>
              ) : null}

              {canApplyRepair ? (
                <Button
                  color="highlight"
                  fullWidth
                  disabled={isBusy}
                  onClick={async () => {
                    await onApplyBottleRepair(item);
                  }}
                >
                  Apply Repair Draft
                </Button>
              ) : null}

              {repairEditHref ? (
                <Button href={repairEditHref} fullWidth>
                  Edit Bottle
                </Button>
              ) : null}

              <Button
                fullWidth
                color={
                  canApproveMatch ||
                  canCreateBottle ||
                  canApplyRepair ||
                  repairEditHref
                    ? "default"
                    : "primary"
                }
                onClick={() => {
                  onChooseBottle(item);
                }}
                disabled={isBusy}
              >
                Choose Bottle
              </Button>

              <Button
                fullWidth
                size="small"
                onClick={async () => {
                  await onRetry(item);
                }}
                disabled={isBusy}
              >
                Retry
              </Button>

              <Button
                color="danger"
                fullWidth
                size="small"
                onClick={async () => {
                  await onIgnore(item);
                }}
                disabled={isBusy}
              >
                Ignore
              </Button>
            </>
          )}
        </aside>
      </div>
      <LinkedBottleChecks checkIds={item.bottleCheckIds} />
    </article>
  );
}
