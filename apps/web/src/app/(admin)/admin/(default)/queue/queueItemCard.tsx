"use client";

import type { Outputs } from "@peated/server/orpc/router";
import Button from "@peated/web/components/button";
import Link from "@peated/web/components/link";
import {
  getBottleBottlingPath,
  getNewBottleBottlingPath,
} from "@peated/web/lib/bottlings";
import classNames from "@peated/web/lib/classNames";
import type { ReactNode } from "react";

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
  brand: { name: string };
  name: string;
  series: { name: string } | null;
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
  distillers: Array<{ name: string }>;
  bottler: { name: string } | null;
};
type RecommendationRelease = {
  id?: number;
  bottleId?: number;
  fullName?: string;
  name?: string;
  edition: string | null;
  statedAge: number | null;
  abv: number | null;
  caskStrength: boolean | null;
  singleCask: boolean | null;
  vintageYear: number | null;
  releaseYear: number | null;
  caskType: string | null;
  caskFill: string | null;
  caskSize: string | null;
};

type QueueItemCardProps = {
  isBusy: boolean;
  item: QueueItem;
  returnTo: string;
  onApproveMatch: (item: QueueItem) => Promise<void>;
  onApplyCreateProposal: (item: QueueItem) => Promise<void>;
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

function isRepairProposal(item: QueueItem): boolean {
  return (
    item.proposalType === "correction" &&
    !!item.currentBottle &&
    !!item.suggestedBottle &&
    item.currentBottle.id === item.suggestedBottle.id &&
    !!item.proposedBottle &&
    !item.proposedRelease
  );
}

function getBottleTitle(bottle: RecommendationBottle): string {
  return bottle.fullName ?? `${bottle.brand.name} ${bottle.name}`.trim();
}

function getBottlingTitle(release: RecommendationRelease): string {
  if (release.name) {
    return release.name;
  }

  if (release.edition) {
    return release.edition;
  }

  if (release.releaseYear !== null && release.vintageYear !== null) {
    return `${release.releaseYear} Bottling (${release.vintageYear} Vintage)`;
  }

  if (release.releaseYear !== null) {
    return `${release.releaseYear} Bottling`;
  }

  if (release.vintageYear !== null) {
    return `${release.vintageYear} Vintage`;
  }

  if (release.statedAge !== null) {
    return `${release.statedAge}-year-old bottling`;
  }

  if (release.singleCask) {
    return "Single cask bottling";
  }

  if (release.caskStrength) {
    return "Cask strength bottling";
  }

  return "Specific bottling";
}

function getBottleFields(bottle: RecommendationBottle): RecommendationField[] {
  const fields: RecommendationField[] = [
    {
      label: "Brand",
      value: bottle.brand.name,
    },
    {
      label: "Bottle Name",
      value: bottle.name,
    },
  ];

  if (bottle.series) {
    fields.push({
      label: "Series",
      value: bottle.series.name,
    });
  }

  if (bottle.edition) {
    fields.push({
      label: "Edition",
      value: bottle.edition,
    });
  }

  if (bottle.statedAge !== null) {
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

  if (bottle.distillers.length > 0) {
    fields.push({
      label: "Distillery",
      value: bottle.distillers.map((distiller) => distiller.name).join(", "),
      fullWidth: true,
    });
  }

  if (bottle.bottler) {
    fields.push({
      label: "Bottler",
      value: bottle.bottler.name,
      fullWidth: true,
    });
  }

  return fields;
}

function getBottlingFields(
  release: RecommendationRelease,
): RecommendationField[] {
  const fields: RecommendationField[] = [];
  const caskDetails = [
    release.caskType,
    release.caskFill,
    release.caskSize,
  ].filter(Boolean);

  if (release.edition) {
    fields.push({
      label: "Edition",
      value: release.edition,
    });
  }

  if (release.statedAge !== null) {
    fields.push({
      label: "Age",
      value: formatAge(release.statedAge),
    });
  }

  if (release.abv !== null) {
    fields.push({
      label: "ABV",
      value: formatAbv(release.abv),
    });
  }

  if (release.releaseYear !== null) {
    fields.push({
      label: "Release Year",
      value: release.releaseYear,
    });
  }

  if (release.vintageYear !== null) {
    fields.push({
      label: "Vintage Year",
      value: release.vintageYear,
    });
  }

  if (release.caskStrength) {
    fields.push({
      label: "Strength",
      value: "Cask strength",
    });
  }

  if (release.singleCask) {
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

function getBottleRepairChanges(
  currentBottle: RecommendationBottle,
  proposedBottle: RecommendationBottle,
): RepairChange[] {
  const changes: RepairChange[] = [];
  const pushChange = (
    label: string,
    current: string | null,
    proposed: string | null,
  ) => {
    if ((current ?? null) === (proposed ?? null)) {
      return;
    }

    changes.push({
      label,
      current: formatRepairValue(current),
      proposed: formatRepairValue(proposed),
    });
  };

  pushChange("Brand", currentBottle.brand.name, proposedBottle.brand.name);
  pushChange("Bottle Name", currentBottle.name, proposedBottle.name);
  pushChange(
    "Series",
    currentBottle.series?.name ?? null,
    proposedBottle.series?.name ?? null,
  );
  pushChange("Category", currentBottle.category, proposedBottle.category);
  pushChange(
    "Distillery",
    currentBottle.distillers.map((distiller) => distiller.name).join(", ") ||
      null,
    proposedBottle.distillers.map((distiller) => distiller.name).join(", ") ||
      null,
  );
  pushChange(
    "Bottler",
    currentBottle.bottler?.name ?? null,
    proposedBottle.bottler?.name ?? null,
  );
  pushChange(
    "Age",
    formatAge(currentBottle.statedAge),
    formatAge(proposedBottle.statedAge),
  );
  pushChange("Edition", currentBottle.edition, proposedBottle.edition);
  pushChange(
    "ABV",
    formatAbv(currentBottle.abv),
    formatAbv(proposedBottle.abv),
  );
  pushChange(
    "Cask Strength",
    formatFlag(currentBottle.caskStrength),
    formatFlag(proposedBottle.caskStrength),
  );
  pushChange(
    "Single Cask",
    formatFlag(currentBottle.singleCask),
    formatFlag(proposedBottle.singleCask),
  );
  pushChange("Cask", currentBottle.caskType, proposedBottle.caskType);
  pushChange("Cask Size", currentBottle.caskSize, proposedBottle.caskSize);
  pushChange("Cask Fill", currentBottle.caskFill, proposedBottle.caskFill);
  pushChange(
    "Vintage Year",
    currentBottle.vintageYear?.toString() ?? null,
    proposedBottle.vintageYear?.toString() ?? null,
  );
  pushChange(
    "Release Year",
    currentBottle.releaseYear?.toString() ?? null,
    proposedBottle.releaseYear?.toString() ?? null,
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

  const bottle =
    item.suggestedBottle ?? item.proposedBottle ?? item.parentBottle;
  const bottleFields = bottle ? getBottleFields(bottle) : [];
  const bottleHref =
    item.suggestedBottle || item.parentBottle
      ? `/bottles/${(item.suggestedBottle ?? item.parentBottle)?.id}`
      : undefined;
  const release = item.suggestedRelease ?? item.proposedRelease;
  const releaseFields = release ? getBottlingFields(release) : [];
  const releaseHref = item.suggestedRelease
    ? getBottleBottlingPath(
        item.suggestedRelease.bottleId,
        item.suggestedRelease.id,
      )
    : undefined;
  const repairChanges =
    isRepairProposal(item) && item.currentBottle && item.proposedBottle
      ? getBottleRepairChanges(item.currentBottle, item.proposedBottle)
      : [];

  if (!bottle && !release) {
    return (
      <div className="mt-2 text-sm text-slate-300">No strong suggestion.</div>
    );
  }

  if (isRepairProposal(item) && item.currentBottle && item.proposedBottle) {
    return (
      <div className="mt-3 space-y-3">
        <RecommendationSection
          label="Existing Bottle"
          title={getBottleTitle(item.currentBottle)}
          href={`/bottles/${item.currentBottle.id}`}
          fields={getBottleFields(item.currentBottle)}
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
          Edit the current bottle, then retry this proposal to confirm the
          repaired metadata.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <RecommendationSection
        label="Main Bottle"
        title={bottle ? getBottleTitle(bottle) : null}
        href={bottleHref}
        fields={bottleFields}
        placeholder="No bottle identified"
      />

      <RecommendationSection
        label="Bottling"
        title={release ? getBottlingTitle(release) : null}
        href={releaseHref}
        fields={releaseFields}
        placeholder="No specific bottling identified"
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
  if (!item.proposedBottle && !item.proposedRelease) {
    return null;
  }

  const queryString = `proposal=${item.id}&returnTo=${encodeURIComponent(returnTo)}`;

  switch (item.creationTarget) {
    case "release":
      return {
        applyLabel: "Apply Bottling Draft",
        editLabel: "Edit Bottling Draft",
        editHref: item.parentBottle
          ? `${getNewBottleBottlingPath(item.parentBottle.id)}?${queryString}`
          : `/addBottle?${queryString}`,
      };
    case "bottle_and_release":
      return {
        applyLabel: "Apply Create Draft",
        editLabel: "Edit Create Draft",
        editHref: `/addBottle?${queryString}`,
      };
    default:
      return {
        applyLabel: "Apply Bottle Draft",
        editLabel: "Edit Bottle Draft",
        editHref: `/addBottle?${queryString}`,
      };
  }
}

export default function QueueItemCard({
  isBusy,
  item,
  returnTo,
  onApproveMatch,
  onApplyCreateProposal,
  onChooseBottle,
  onIgnore,
  onRetry,
}: QueueItemCardProps) {
  const evidenceBadges = getEvidenceBadges(item);
  const extractedLabelSummary = getExtractedLabelSummary(item);
  const topCandidates = getTopCandidates(item);
  const repairProposal = isRepairProposal(item);
  const isProcessing = item.isProcessing;
  const canApproveMatch =
    item.status === "pending_review" &&
    !!item.suggestedBottle &&
    !repairProposal &&
    !isProcessing;
  const canCreateBottle =
    item.status === "pending_review" &&
    item.proposalType === "create_new" &&
    (!!item.proposedBottle || !!item.proposedRelease) &&
    !isProcessing;
  const createProposalActions = getCreateProposalActions(item, returnTo);
  const repairEditHref =
    repairProposal && item.currentBottle
      ? `/bottles/${item.currentBottle.id}/edit`
      : null;
  const queuedAt = formatTimestamp(item.createdAt);
  const processingQueuedAt = formatTimestamp(item.processingQueuedAt);
  const processingExpiresAt = formatTimestamp(item.processingExpiresAt);

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

          {item.currentBottle ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm">
              <div className="text-muted text-xs font-semibold uppercase tracking-wide">
                Current Bottle
              </div>
              <Link
                href={`/bottles/${item.currentBottle.id}`}
                className="mt-1 inline-block font-semibold text-white underline"
              >
                {item.currentBottle.fullName}
              </Link>
              {item.currentRelease ? (
                <div className="mt-1 text-slate-300">
                  Bottling: {item.currentRelease.fullName}
                </div>
              ) : null}
            </div>
          ) : null}

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
          {isProcessing ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-3 text-sm text-slate-300">
              Retry lease is active. Review actions return when the retry
              finishes or the lease expires.
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

              {repairEditHref ? (
                <Button href={repairEditHref} color="highlight" fullWidth>
                  Edit Bottle
                </Button>
              ) : null}

              <Button
                fullWidth
                color={
                  canApproveMatch || canCreateBottle || repairEditHref
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
    </article>
  );
}
