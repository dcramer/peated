import type { Bottle, BottleRelease } from "@peated/server/types";
import type { CreateBottlePrefill } from "@peated/web/components/search/createBottleHref";
import type { ReactNode } from "react";

import type { PhotoIdentification } from "./helpers";

export type BottleResolverTarget = {
  bottle: Bottle;
  release: BottleRelease | null;
  hasExactLibraryEntry: boolean;
  pendingImage: PhotoIdentification["pendingImage"] | null;
  /** Blob preview ownership transfers to the resolver caller only after onResolve succeeds. */
  previewUrl: string | null;
  resultSource?: "created" | "found";
  photoTrace?: {
    traceId: string;
    copyPayload: string;
  };
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

export type BottleResolverProps = {
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
  renderMatchedResultActions?: (
    props: BottleResolverMatchedActionsProps,
  ) => ReactNode;
  createProposalActionLabel?: string;
  searchActionLabel?: string;
};
