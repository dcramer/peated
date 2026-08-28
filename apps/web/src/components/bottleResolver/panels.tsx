import {
  Button,
  ButtonLink,
  FactList,
  FormGrid,
  FormNotice,
  FormSection,
  FormStack,
  IconButton,
  SelectedBottleSummary,
} from "@peated/web/components/designSystem/components";
import { copyTextToClipboard } from "@peated/web/lib/clipboard";
import { logError } from "@peated/web/lib/log";
import { Copy, Plus, RotateCcw, Search } from "lucide-react";
import { type ReactNode, useState } from "react";

import { getFieldValue, type PhotoIdentification } from "./fieldValues";

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
    ["Series", getFieldValue(result, "series")],
    ["Distillers", getFieldValue(result, "distillery")],
    ["Bottler", getFieldValue(result, "bottler")],
    ["Category", getFieldValue(result, "category")],
    ["Age", getFieldValue(result, "statedAge")],
    ["ABV", getFieldValue(result, "abv")],
    ["Edition", getFieldValue(result, "edition")],
    ["Vintage", getFieldValue(result, "vintageYear")],
    ["Bottled", getFieldValue(result, "bottlingYear")],
    ["Release", getFieldValue(result, "releaseYear")],
    ["Cask", getFieldValue(result, "caskNumber")],
    ["Cask Strength", getFieldValue(result, "caskStrength")],
    ["Single Cask", getFieldValue(result, "singleCask")],
  ].filter(([, value]) => value);

  if (!fields.length) return null;
  // SAFETY: the empty list returned above guarantees at least one fact.
  return (
    <FactList
      facts={
        fields.map(([label, value]) => ({ label, value })) as [
          { label: string; value: string },
          ...{ label: string; value: string }[],
        ]
      }
    />
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
    <FormStack>
      {previewUrl ? (
        <SelectedBottleSummary
          bottleId="Uploaded photo"
          imageUrl={previewUrl}
          metadata="No catalog match selected"
          name={title}
        />
      ) : null}
      {isError ? <FormNotice role="alert">{description}</FormNotice> : null}
      <FormSection
        description={isError ? undefined : description}
        title={title}
      >
        {children}
        <FormGrid>
          {primaryAction === "create" && createBottleHref ? (
            <>
              <ButtonLink fullWidth href={createBottleHref} variant="accent">
                <Plus aria-hidden="true" size={16} />
                {createBottleLabel}
              </ButtonLink>
              <ButtonLink fullWidth href={searchHref} variant="tonal">
                <Search aria-hidden="true" size={16} />
                {searchLabel}
              </ButtonLink>
            </>
          ) : (
            <>
              <ButtonLink fullWidth href={searchHref} variant="accent">
                <Search aria-hidden="true" size={16} />
                {searchLabel}
              </ButtonLink>
              {createBottleHref && (
                <ButtonLink fullWidth href={createBottleHref} variant="tonal">
                  <Plus aria-hidden="true" size={16} />
                  {createBottleLabel}
                </ButtonLink>
              )}
            </>
          )}
          <Button fullWidth onClick={onStartOver} variant="tonal">
            <RotateCcw aria-hidden="true" size={16} />
            Start over
          </Button>
        </FormGrid>
      </FormSection>
    </FormStack>
  );
}

/** Builds the trace footer payload used to reproduce or evaluate a photo identification. */
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
    <FormNotice>
      Trace ID: {traceId}{" "}
      <IconButton
        icon={<Copy aria-hidden="true" size={14} />}
        label="Copy photo identification payload"
        onClick={() => void copyTracePayload()}
        size="sm"
        title="Copy photo identification payload"
        variant="text"
      />
      <span role="status">
        {copied ? " Copied" : copyFailed ? " Copy failed" : ""}
      </span>
    </FormNotice>
  );
}

/** Builds the trace footer payload for failures before the server returns a result. */
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
  createBottleHref,
  createBottleLabel = "Create Bottle",
  title,
  description,
  onStartOver,
  showStartOver = false,
}: {
  searchHref: string;
  searchLabel: string;
  createBottleHref?: string | null;
  createBottleLabel?: string;
  title?: string;
  description?: string;
  onStartOver?: () => void;
  showStartOver?: boolean;
}) {
  const actions = (
    <FormGrid>
      <ButtonLink fullWidth href={searchHref} variant="tonal">
        <Search aria-hidden="true" size={16} />
        {searchLabel}
      </ButtonLink>
      {createBottleHref ? (
        <ButtonLink fullWidth href={createBottleHref} variant="tonal">
          <Plus aria-hidden="true" size={16} />
          {createBottleLabel}
        </ButtonLink>
      ) : null}
      {showStartOver && onStartOver ? (
        <Button fullWidth onClick={onStartOver} variant="tonal">
          <RotateCcw aria-hidden="true" size={16} />
          Start over
        </Button>
      ) : null}
    </FormGrid>
  );

  return title ? (
    <FormSection description={description} title={title}>
      {actions}
    </FormSection>
  ) : (
    actions
  );
}
