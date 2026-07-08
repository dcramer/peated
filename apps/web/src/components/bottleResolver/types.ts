import type { Bottle, BottleRelease } from "@peated/server/types";
import type { CreateBottlePrefill } from "@peated/web/components/search/createBottleHref";
import type { ReactNode } from "react";

import type { PhotoIdentification } from "./helpers";

export type PendingImageRef = Pick<
  PhotoIdentification["pendingImage"],
  "id" | "imageUrl"
>;

export type BottleResolverTarget = {
  bottle: Bottle;
  release: BottleRelease | null;
  hasExactLibraryEntry: boolean;
  exactLibraryEntryImageUrl?: string | null;
  pendingImage: PendingImageRef | null;
  /** Blob preview ownership transfers to the resolver caller only after onResolve succeeds. */
  previewUrl: string | null;
  resultSource?: "created" | "found";
  photoTrace?: {
    traceId: string;
    copyPayload: string;
  };
  warnings?: string[];
};

export type BottleResolverAction = "library" | "tasting" | "create";
export type BottleResolverMatchedAction = Exclude<
  BottleResolverAction,
  "create"
>;

export type BottleResolverMatchedActionsProps = {
  bottleId: number;
  releaseId: number | null;
  hasExactLibraryEntry: boolean;
  exactLibraryEntryImageUrl?: string | null;
  pendingImage: PendingImageRef | null;
  loadingExactLibraryStatus: boolean;
  resolvingAction: BottleResolverMatchedAction | null;
  onResolve: (action: BottleResolverMatchedAction) => void;
};

export type BottleResolverCreateProposalActionsProps = {
  createPending: boolean;
  resolvingAction: BottleResolverAction | null;
  onResolve: (action: BottleResolverAction) => void;
};

export type BottleResolverProps = {
  onResolve: (
    target: BottleResolverTarget,
    action?: BottleResolverAction,
  ) => Promise<void> | void;
  searchHrefForQuery: (
    query?: string,
    pendingImage?: PendingImageRef | null,
  ) => string;
  createBottleHrefForResult?: (
    query: string,
    prefill?: CreateBottlePrefill,
    pendingImage?: PendingImageRef | null,
  ) => string;
  title: string;
  renderMatchedResultActions?: (
    props: BottleResolverMatchedActionsProps,
  ) => ReactNode;
  renderCreateProposalActions?: (
    props: BottleResolverCreateProposalActionsProps,
  ) => ReactNode;
  createProposalActionLabel?: string;
  searchActionLabel?: string;
};
