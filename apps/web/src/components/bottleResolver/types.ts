import type { Bottle } from "@peated/server/types";
import type { CreateBottlePrefill } from "@peated/web/components/search/createBottleHref";
import type { ReactNode } from "react";

import type { PhotoIdentification } from "./helpers";

export type PendingImageRef = Pick<
  PhotoIdentification["pendingImage"],
  "id" | "imageUrl"
>;

export type BottleResolverResult = {
  bottle: Bottle;
  hasLibraryEntry: boolean;
  libraryEntryImageUrl?: string | null;
  pendingImage: PendingImageRef | null;
  /** Blob preview ownership transfers to the resolver caller only after onResolve succeeds. */
  previewUrl: string | null;
  resultSource?: "created" | "found";
  photoTrace?: {
    traceId: string;
    copyPayload: string;
  };
  warnings?: string[];
  /** The member's "Not my bottle" report, kept so a later change still saves. */
  wrongPhotoMatchId?: number | null;
};

export type BottleResolverAction = "library" | "tasting" | "create";
export type BottleResolverMatchedAction = Exclude<
  BottleResolverAction,
  "create"
>;

export type BottleResolverMatchedActionsProps = {
  bottle: Bottle;
  hasLibraryEntry: boolean;
  libraryEntryImageUrl?: string | null;
  pendingImage: PendingImageRef | null;
  loadingExactLibraryStatus: boolean;
  resolvingAction: BottleResolverMatchedAction | null;
  /** True while the member's "Not my bottle" report is saving. */
  disabled?: boolean;
  onResolve: (action: BottleResolverMatchedAction) => void;
};

export type BottleResolverCreateProposalActionsProps = {
  createPending: boolean;
  resolvingAction: BottleResolverAction | null;
  onResolve: (action: BottleResolverAction) => void;
};

export type BottleResolverProps = {
  onResolve: (
    result: BottleResolverResult,
    action?: BottleResolverAction,
  ) => Promise<void> | void;
  /** `wrongPhotoMatchId` names the reported match to complete with the chosen Bottle. */
  searchHrefForQuery: (
    query?: string,
    pendingImage?: PendingImageRef | null,
    wrongPhotoMatchId?: number | null,
  ) => string;
  createBottleHrefForResult?: (
    query: string,
    prefill?: CreateBottlePrefill,
    pendingImage?: PendingImageRef | null,
    wrongPhotoMatchId?: number | null,
  ) => string;
  title: string;
  renderMatchedResultActions?: (
    props: BottleResolverMatchedActionsProps,
  ) => ReactNode;
  renderCreateProposalActions?: (
    props: BottleResolverCreateProposalActionsProps,
  ) => ReactNode;
  createProposalActionLabel?: string;
  /** Lets the route supply its existing bottle search. */
  search?: ReactNode;
  searchActionLabel?: string;
};
