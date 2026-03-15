"use client";

import type { Outputs } from "@peated/server/orpc/router";
import Button from "@peated/web/components/button";
import Link from "@peated/web/components/link";
import classNames from "@peated/web/lib/classNames";

export type QueueItem =
  Outputs["prices"]["matchQueue"]["list"]["results"][number];
type Candidate = QueueItem["candidateBottles"][number];

type QueueItemCardProps = {
  isBusy: boolean;
  item: QueueItem;
  returnTo: string;
  onApproveMatch: (item: QueueItem) => Promise<void>;
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

  return item.confidence === null ? "?" : `${item.confidence}`;
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

  if (item.currentBottle && item.proposalType === "correction") {
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
  if (extractedLabel.distillery?.length) {
    summary.push(`distillery: ${extractedLabel.distillery.join(", ")}`);
  }

  return summary;
}

function getRecommendationTitle(item: QueueItem): string {
  if (item.status === "errored") {
    return "No recommendation available";
  }

  if (item.suggestedBottle) {
    return item.suggestedBottle.fullName;
  }

  if (item.proposedBottle) {
    return `${item.proposedBottle.brand.name} ${item.proposedBottle.name}`.trim();
  }

  return "No strong suggestion";
}

function getRecommendationHeading(item: QueueItem): string {
  if (item.status === "errored") {
    return "Review Status";
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

export default function QueueItemCard({
  isBusy,
  item,
  returnTo,
  onApproveMatch,
  onChooseBottle,
  onIgnore,
  onRetry,
}: QueueItemCardProps) {
  const evidenceBadges = getEvidenceBadges(item);
  const extractedLabelSummary = getExtractedLabelSummary(item);
  const topCandidates = getTopCandidates(item);
  const isProcessing = item.isProcessing;
  const canApproveMatch =
    item.status === "pending_review" && !!item.suggestedBottle && !isProcessing;
  const canCreateBottle =
    item.status === "pending_review" && !!item.proposedBottle && !isProcessing;
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
                Confidence {formatConfidence(item)}
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
            <div className="mt-2 text-base font-semibold text-white">
              {item.suggestedBottle ? (
                <Link
                  href={`/bottles/${item.suggestedBottle.id}`}
                  className="underline"
                >
                  {getRecommendationTitle(item)}
                </Link>
              ) : (
                getRecommendationTitle(item)
              )}
            </div>

            {item.proposedBottle ? (
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted text-xs uppercase tracking-wide">
                    Brand
                  </dt>
                  <dd className="mt-1 text-slate-100">
                    {item.proposedBottle.brand.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted text-xs uppercase tracking-wide">
                    Bottle Name
                  </dt>
                  <dd className="mt-1 text-slate-100">
                    {item.proposedBottle.name}
                  </dd>
                </div>
                {item.proposedBottle.statedAge !== null ? (
                  <div>
                    <dt className="text-muted text-xs uppercase tracking-wide">
                      Age
                    </dt>
                    <dd className="mt-1 text-slate-100">
                      {item.proposedBottle.statedAge}
                    </dd>
                  </div>
                ) : null}
                {item.proposedBottle.series ? (
                  <div>
                    <dt className="text-muted text-xs uppercase tracking-wide">
                      Series
                    </dt>
                    <dd className="mt-1 text-slate-100">
                      {item.proposedBottle.series.name}
                    </dd>
                  </div>
                ) : null}
                {item.proposedBottle.distillers.length > 0 ? (
                  <div className="col-span-2">
                    <dt className="text-muted text-xs uppercase tracking-wide">
                      Distillery
                    </dt>
                    <dd className="mt-1 text-slate-100">
                      {item.proposedBottle.distillers
                        .map((distiller) => distiller.name)
                        .join(", ")}
                    </dd>
                  </div>
                ) : null}
                {item.proposedBottle.bottler ? (
                  <div className="col-span-2">
                    <dt className="text-muted text-xs uppercase tracking-wide">
                      Bottler
                    </dt>
                    <dd className="mt-1 text-slate-100">
                      {item.proposedBottle.bottler.name}
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
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
                  href={`/addBottle?proposal=${item.id}&returnTo=${encodeURIComponent(returnTo)}`}
                  color="highlight"
                  fullWidth
                >
                  Create Bottle
                </Button>
              ) : null}

              <Button
                fullWidth
                color={
                  canApproveMatch || canCreateBottle ? "default" : "primary"
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
