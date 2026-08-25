"use client";

import { CheckIcon, ClipboardDocumentIcon } from "@heroicons/react/20/solid";
import { copyTextToClipboard } from "@peated/web/lib/clipboard";
import { useState } from "react";
import Link from "./link";

export default function PeatedId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const pathname = `/${value}`;

  return (
    <div className="text-muted inline-flex items-center gap-1 text-xs">
      <span>ID</span>
      <Link
        href={pathname}
        className="focus-visible:ring-highlight rounded font-mono font-semibold text-white hover:underline focus-visible:outline-none focus-visible:ring-2"
      >
        {value}
      </Link>
      <button
        type="button"
        className="hover:text-highlight focus-visible:ring-highlight inline-flex h-6 w-6 items-center justify-center rounded text-white focus-visible:outline-none focus-visible:ring-2"
        aria-label={`Copy ${value} link`}
        title={copied ? "Copied" : "Copy Peated ID link"}
        onClick={async () => {
          try {
            await copyTextToClipboard(
              new URL(pathname, window.location.origin).toString(),
            );
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? (
          <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ClipboardDocumentIcon className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
