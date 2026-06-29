"use client";

import {
  BookOpenIcon as BookOpenIconFilled,
  StarIcon as StarIconFilled,
} from "@heroicons/react/20/solid";
import { BookOpenIcon, StarIcon } from "@heroicons/react/24/outline";
import { isORPCClientError } from "@peated/orpc/client/errors";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from "react";
import useAuth from "../hooks/useAuth";
import { useORPC } from "../lib/orpc/context";
import Button from "./button";

type CollectionActionProps = {
  bottleId: number;
  releaseId?: number | null;
  size?: "small" | "base";
  title?: string;
};

type CollectionActionKind = "favorites" | "library";

type CollectionIcon = ForwardRefExoticComponent<
  Omit<SVGProps<SVGSVGElement>, "ref"> & RefAttributes<SVGSVGElement>
>;

const COLLECTION_ACTIONS: Record<
  CollectionActionKind,
  {
    collection: "default" | "library";
    color: "primary" | "default";
    Icon: CollectionIcon;
    ActiveIcon: CollectionIcon;
  }
> = {
  favorites: {
    collection: "default",
    color: "primary",
    Icon: StarIcon,
    ActiveIcon: StarIconFilled,
  },
  library: {
    collection: "library",
    color: "primary",
    Icon: BookOpenIcon,
    ActiveIcon: BookOpenIconFilled,
  },
};

function getTitle({
  baseOnly,
  kind,
  title,
}: {
  baseOnly: boolean;
  kind: CollectionActionKind;
  title?: string;
}) {
  if (kind === "favorites") {
    return title ?? (baseOnly ? "Save Bottle" : "Save Specific Bottling");
  }

  return baseOnly
    ? "Save Bottle to Library"
    : "Save Specific Bottling to Library";
}

function SavedCollectionActionAuthenticated({
  bottleId,
  releaseId,
  size,
  title,
  kind,
}: CollectionActionProps & { kind: CollectionActionKind }) {
  const { user } = useAuth();
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const action = COLLECTION_ACTIONS[kind];
  const Icon = action.Icon;
  const ActiveIcon = action.ActiveIcon;
  const baseOnly = releaseId == null;
  const resolvedTitle = getTitle({ baseOnly, kind, title });
  const favoriteBottleMutation = useMutation(
    orpc.collections.bottles.create.mutationOptions(),
  );
  const unfavoriteBottleMutation = useMutation(
    orpc.collections.bottles.delete.mutationOptions(),
  );

  let isCollected = false;
  let isLoading = false;
  const collectionStatusQuery = orpc.collections.bottles.list.queryOptions({
    input: {
      user: "me",
      collection: action.collection,
      bottle: bottleId,
      release: releaseId ?? undefined,
      baseOnly,
    },
    select: (data) => data.results.length > 0,
  });
  try {
    const result = useSuspenseQuery(collectionStatusQuery);
    isCollected = result.data;
    isLoading = result.isLoading;
  } catch (err: unknown) {
    if (isORPCClientError(err) && err.name === "UNAUTHORIZED") {
      return (
        <SavedCollectionActionUnauthenticated
          releaseId={releaseId}
          size={size}
          title={title}
          kind={kind}
        />
      );
    }
    throw err;
  }

  const isAnyLoading =
    isLoading ||
    favoriteBottleMutation.isPending ||
    unfavoriteBottleMutation.isPending;

  return (
    <Button
      onClick={async () => {
        await (isCollected
          ? unfavoriteBottleMutation.mutateAsync({
              bottle: bottleId,
              release: releaseId,
              baseOnly,
              user: "me",
              collection: action.collection,
            })
          : favoriteBottleMutation.mutateAsync({
              bottle: bottleId,
              release: releaseId,
              user: "me",
              collection: action.collection,
            }));
        await queryClient.invalidateQueries({
          queryKey: collectionStatusQuery.queryKey,
        });
        if (user) {
          await queryClient.invalidateQueries({
            queryKey: orpc.collections.bottles.list.key({
              input: {
                user: "me",
                collection: action.collection,
              },
            }),
            exact: true,
          });
          await queryClient.invalidateQueries({
            queryKey: orpc.collections.bottles.list.key({
              input: {
                user: user.username,
                collection: action.collection,
              },
            }),
            exact: true,
          });
        }
      }}
      disabled={isAnyLoading}
      color={action.color}
      size={size}
      title={resolvedTitle}
      aria-pressed={isCollected}
      data-collection-action={kind}
    >
      {isCollected ? (
        <ActiveIcon className="text-highlight h-4 w-4" aria-hidden="true" />
      ) : (
        <Icon className="h-4 w-4" aria-hidden="true" />
      )}
    </Button>
  );
}

function SavedCollectionActionUnauthenticated({
  releaseId,
  size,
  title,
  kind,
}: Pick<CollectionActionProps, "releaseId" | "size" | "title"> & {
  kind: CollectionActionKind;
}) {
  const action = COLLECTION_ACTIONS[kind];
  const Icon = action.Icon;
  const resolvedTitle = getTitle({ baseOnly: releaseId == null, kind, title });

  return (
    <Button
      href="/login"
      color={action.color}
      size={size}
      title={resolvedTitle}
      data-collection-action={kind}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}

function SavedCollectionAction({
  kind,
  ...props
}: CollectionActionProps & { kind: CollectionActionKind }) {
  const { user } = useAuth();

  if (!user) {
    return <SavedCollectionActionUnauthenticated {...props} kind={kind} />;
  }

  return <SavedCollectionActionAuthenticated {...props} kind={kind} />;
}

export function FavoriteAction(props: CollectionActionProps) {
  return <SavedCollectionAction {...props} kind="favorites" />;
}

export function LibraryAction(props: CollectionActionProps) {
  return <SavedCollectionAction {...props} kind="library" />;
}

export default function SavedCollectionActions(props: CollectionActionProps) {
  return (
    <>
      <FavoriteAction {...props} />
      <LibraryAction {...props} />
    </>
  );
}
