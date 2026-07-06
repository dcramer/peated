import Button from "@peated/web/components/button";
import { copyTextToClipboard } from "@peated/web/lib/clipboard";
import { logError } from "@peated/web/lib/log";
import {
  AlertTriangle,
  Copy,
  Plus,
  RotateCcw,
  Search,
  SearchX,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import {
  getFieldValue,
  type PhotoIdentification,
} from "./bottleResolver.helpers";

export type PhotoFailureTrace = {
  traceId: string;
  file: {
    name: string;
    size: number;
    type: string | null;
    lastModified: number;
  };
  error: string;
};

export function EvidencePills({
  result,
}: {
  result: PhotoIdentification | null;
}) {
  const fields = [
    ["Brand", getFieldValue(result, "brand")],
    ["Expression", getFieldValue(result, "expression")],
    ["Age", getFieldValue(result, "statedAge")],
    ["ABV", getFieldValue(result, "abv")],
    ["Edition", getFieldValue(result, "edition")],
    ["Vintage", getFieldValue(result, "vintageYear")],
    ["Release", getFieldValue(result, "releaseYear")],
    ["Cask", getFieldValue(result, "caskNumber")],
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

export function ResultHeader({
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

export function PhotoFailurePanel({
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

export function getPhotoIdentificationCopyPayload(
  result: PhotoIdentification,
  traceId: string,
) {
  return JSON.stringify(
    {
      traceId,
      pendingImage: result.pendingImage,
      suggestedNextStep: result.suggestedNextStep,
      diagnostics: result.diagnostics,
      imageEvidence: result.imageEvidence,
      classification: result.classification,
    },
    null,
    2,
  );
}

export function PhotoIdentificationTraceFootnote({
  traceId,
  copyPayload,
}: {
  traceId: string;
  copyPayload: string;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copyTracePayload() {
    setCopied(false);
    setCopyFailed(false);

    try {
      await copyTextToClipboard(copyPayload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      logError(err);
      setCopyFailed(true);
    }
  }

  return (
    <div className="text-muted mx-auto mt-4 flex max-w-full items-center justify-center gap-1.5 px-1 text-center text-xs">
      <span className="min-w-0 truncate">Trace ID: {traceId}</span>
      <button
        type="button"
        className="focus:ring-highlight shrink-0 rounded p-1 transition hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2"
        onClick={() => void copyTracePayload()}
        title="Copy photo identification payload"
        aria-label="Copy photo identification payload"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      <span className="sr-only" role="status">
        {copied
          ? "Photo identification payload copied"
          : copyFailed
            ? "Photo identification payload copy failed"
            : ""}
      </span>
    </div>
  );
}

export function getPhotoFailureCopyPayload(trace: PhotoFailureTrace) {
  return JSON.stringify(
    {
      traceId: trace.traceId,
      file: trace.file,
      error: trace.error,
      context: "add_bottle_photo_identification",
      rpc: "tastings.photoIdentification",
    },
    null,
    2,
  );
}

export function FallbackActions({
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

export function SearchBottleCallout({ searchHref }: { searchHref: string }) {
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
