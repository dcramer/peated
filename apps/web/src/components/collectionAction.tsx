"use client";

import { BookOpenIcon as BookOpenIconFilled } from "@heroicons/react/20/solid";
import { BookOpenIcon } from "@heroicons/react/24/outline";
import { isORPCClientError } from "@peated/orpc/client/errors";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import useAuth from "../hooks/useAuth";
import { useORPC } from "../lib/orpc/context";
import Button from "./button";

type CollectionActionCommonProps = {
  size?: "small" | "base";
  title?: string;
};

type TargetCollectionActionProps = CollectionActionCommonProps & {
  targetId: number;
  bottleId?: never;
  releaseId?: never;
};

type LegacyReleaseCollectionActionProps = CollectionActionCommonProps & {
  targetId?: never;
  bottleId: number;
  releaseId: number;
};

type CollectionActionProps =
  | TargetCollectionActionProps
  | LegacyReleaseCollectionActionProps;

function getTitle({
  specificBottle,
  title,
}: {
  specificBottle: boolean;
  title?: string;
}) {
  return (
    title ??
    (specificBottle
      ? "Save Specific Bottling to Library"
      : "Save Bottle to Library")
  );
}

function SavedCollectionActionAuthenticated({
  targetId,
  size,
  title,
}: TargetCollectionActionProps) {
  const { user } = useAuth();
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const [isMounted, setIsMounted] = useState(false);
  const resolvedTitle = getTitle({ specificBottle: false, title });
  const addToLibraryMutation = useMutation(
    orpc.collections.bottles.create.mutationOptions(),
  );
  const removeFromLibraryMutation = useMutation(
    orpc.collections.bottles.delete.mutationOptions(),
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  let isCollected = false;
  let isLoading = false;
  const collectionStatusQuery = orpc.collections.bottles.list.queryOptions({
    input: {
      user: "me",
      collection: "library",
      target: targetId,
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
          specificBottle={false}
          size={size}
          title={title}
        />
      );
    }
    throw err;
  }

  const isAnyLoading =
    !isMounted ||
    isLoading ||
    addToLibraryMutation.isPending ||
    removeFromLibraryMutation.isPending;

  return (
    <Button
      onClick={async () => {
        await (isCollected
          ? removeFromLibraryMutation.mutateAsync({
              target: targetId,
              user: "me",
              collection: "library",
            })
          : addToLibraryMutation.mutateAsync({
              target: targetId,
              user: "me",
              collection: "library",
            }));
        await queryClient.invalidateQueries({
          queryKey: collectionStatusQuery.queryKey,
        });
        if (user) {
          await queryClient.invalidateQueries({
            queryKey: orpc.collections.bottles.list.key({
              input: {
                user: "me",
                collection: "library",
              },
            }),
            exact: true,
          });
          await queryClient.invalidateQueries({
            queryKey: orpc.collections.bottles.list.key({
              input: {
                user: user.username,
                collection: "library",
              },
            }),
            exact: true,
          });
        }
      }}
      disabled={isAnyLoading}
      color="primary"
      size={size}
      title={resolvedTitle}
      aria-pressed={isCollected}
      data-collection-action="library"
    >
      {isCollected ? (
        <BookOpenIconFilled
          className="text-highlight h-4 w-4"
          aria-hidden="true"
        />
      ) : (
        <BookOpenIcon className="h-4 w-4" aria-hidden="true" />
      )}
    </Button>
  );
}

function SavedCollectionActionUnauthenticated({
  specificBottle,
  size,
  title,
}: CollectionActionCommonProps & { specificBottle: boolean }) {
  const resolvedTitle = getTitle({ specificBottle, title });

  return (
    <Button
      href="/login"
      color="primary"
      size={size}
      title={resolvedTitle}
      data-collection-action="library"
    >
      <BookOpenIcon className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}

function SavedCollectionAction(props: TargetCollectionActionProps) {
  const { user } = useAuth();

  if (!user) {
    return (
      <SavedCollectionActionUnauthenticated
        specificBottle={false}
        size={props.size}
        title={props.title}
      />
    );
  }

  return <SavedCollectionActionAuthenticated {...props} />;
}

function LegacyReleaseCollectionAction({
  bottleId,
  releaseId,
  size,
  title,
}: LegacyReleaseCollectionActionProps) {
  const { user } = useAuth();
  if (!user) {
    return (
      <SavedCollectionActionUnauthenticated
        specificBottle
        size={size}
        title={title}
      />
    );
  }

  return (
    <LegacyReleaseCollectionActionAuthenticated
      bottleId={bottleId}
      releaseId={releaseId}
      size={size}
      title={title}
    />
  );
}

function LegacyReleaseCollectionActionAuthenticated({
  bottleId,
  releaseId,
  size,
  title,
}: LegacyReleaseCollectionActionProps) {
  const orpc = useORPC();
  const { data: promoted } = useSuspenseQuery(
    orpc.bottleReleases.target.queryOptions({
      input: { bottle: bottleId, release: releaseId },
    }),
  );
  const { data: target } = useSuspenseQuery(
    orpc.bottles.target.queryOptions({
      input: { bottle: promoted.bottleId },
    }),
  );

  return (
    <SavedCollectionAction
      targetId={target.targetId}
      size={size}
      title={title}
    />
  );
}

export function LibraryAction(props: TargetCollectionActionProps) {
  return <SavedCollectionAction {...props} />;
}

export default function SavedCollectionActions(props: CollectionActionProps) {
  if (props.targetId !== undefined) {
    return (
      <LibraryAction
        targetId={props.targetId}
        size={props.size}
        title={props.title}
      />
    );
  }
  return (
    <LegacyReleaseCollectionAction
      bottleId={props.bottleId}
      releaseId={props.releaseId}
      size={props.size}
      title={props.title}
    />
  );
}
