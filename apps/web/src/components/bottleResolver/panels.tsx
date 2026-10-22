import { IconButton } from "@peated/web/components/button.stylex";
import { FactList } from "@peated/web/components/factList.stylex";
import { FormNotice } from "@peated/web/components/formLayout.stylex";
import { copyTextToClipboard } from "@peated/web/lib/clipboard";
import { logError } from "@peated/web/lib/log";
import { Copy } from "lucide-react";
import { useState } from "react";

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

export function LabelFacts({
  result,
}: {
  result: Pick<PhotoIdentification, "imageEvidence"> | null;
}) {
  const fields = [
    ["Brand", getFieldValue(result, "brand")],
    ["Name", getFieldValue(result, "expression")],
    ["Series", getFieldValue(result, "series")],
    ["Distillery", getFieldValue(result, "distillery")],
    ["Bottler", getFieldValue(result, "bottler")],
    ["Category", getFieldValue(result, "category")],
    ["Age", getFieldValue(result, "statedAge")],
    ["ABV", getFieldValue(result, "abv")],
    ["Edition", getFieldValue(result, "edition")],
    ["Vintage", getFieldValue(result, "vintageYear")],
    ["Bottled", getFieldValue(result, "bottlingYear")],
    ["Release", getFieldValue(result, "releaseYear")],
    ["Cask", getFieldValue(result, "caskNumber")],
    ["Cask strength", getFieldValue(result, "caskStrength")],
    ["Single cask", getFieldValue(result, "singleCask")],
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
