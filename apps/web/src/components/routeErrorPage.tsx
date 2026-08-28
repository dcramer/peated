"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import {
  CapturedFailurePage,
  OfflinePage,
} from "./designSystem/product/errorPages.stylex";

const MAX_STACK_FRAMES = 40;
const MAX_STACK_LENGTH = 8_000;

function subscribeToOnlineStatus(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);

  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOnlineStatus() {
  return navigator.onLine;
}

function getServerOnlineStatus() {
  return true;
}

function projectSafeStack(error: Error): string | undefined {
  if (!error.stack) {
    return undefined;
  }

  const frames = error.stack
    .split("\n")
    .filter((line) => /^\s*at\s+/.test(line))
    .slice(0, MAX_STACK_FRAMES)
    .map((line) =>
      line
        .replace(/([?#])[^\s)]*/g, "")
        .replace(/\/Users\/[^/]+\//g, "/Users/[redacted]/")
        .replace(/\\Users\\[^\\]+\\/g, "\\Users\\[redacted]\\"),
    );

  if (frames.length === 0) {
    return undefined;
  }

  return ["Application error", ...frames].join("\n").slice(0, MAX_STACK_LENGTH);
}

export default function RouteErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isOnline = useSyncExternalStore(
    subscribeToOnlineStatus,
    getOnlineStatus,
    getServerOnlineStatus,
  );
  const stack = useMemo(() => projectSafeStack(error), [error]);
  const [sentryEventId, setSentryEventId] = useState<string>();

  useEffect(() => {
    try {
      const eventId = Sentry.captureException(error, {
        tags: error.digest
          ? {
              "nextjs.digest": error.digest,
            }
          : undefined,
      });
      // Sentry owns this reference; the boundary re-renders once capture returns it.
      // oxlint-disable-next-line react/set-state-in-effect
      setSentryEventId(eventId);
    } catch {
      // oxlint-disable-next-line react/set-state-in-effect
      setSentryEventId(undefined);
      // Telemetry must not prevent the owning error boundary from recovering.
    }
  }, [error]);

  if (!isOnline) {
    return <OfflinePage onRetry={reset} />;
  }

  return (
    <CapturedFailurePage
      incidentReference={sentryEventId}
      onCopyReference={
        sentryEventId
          ? () => void navigator.clipboard?.writeText(sentryEventId)
          : undefined
      }
      onRetry={reset}
      stack={stack}
    />
  );
}
