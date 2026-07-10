"use client";

import { BookOpenIcon as BookOpenIconFilled } from "@heroicons/react/20/solid";
import { BookOpenIcon } from "@heroicons/react/24/outline";
import { isORPCClientError } from "@peated/orpc/client/errors";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import useAuth from "../hooks/useAuth";
import { useORPC } from "../lib/orpc/context";
import Button from "./button";

type CollectionActionProps = {
  bottleId: number;
  releaseId?: number | null;
  size?: "small" | "base";
  title?: string;
};

function getTitle({ baseOnly, title }: { baseOnly: boolean; title?: string }) {
  return (
    title ??
    (baseOnly ? "Save Bottle to Library" : "Save Specific Bottling to Library")
  );
}

function SavedCollectionActionAuthenticated({
  bottleId,
  releaseId,
  size,
  title,
}: CollectionActionProps) {
  const { user } = useAuth();
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const [isMounted, setIsMounted] = useState(false);
  const baseOnly = releaseId == null;
  const resolvedTitle = getTitle({ baseOnly, title });
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
              bottle: bottleId,
              release: releaseId,
              baseOnly,
              user: "me",
              collection: "library",
            })
          : addToLibraryMutation.mutateAsync({
              bottle: bottleId,
              release: releaseId,
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
  releaseId,
  size,
  title,
}: Pick<CollectionActionProps, "releaseId" | "size" | "title">) {
  const resolvedTitle = getTitle({ baseOnly: releaseId == null, title });

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

function SavedCollectionAction(props: CollectionActionProps) {
  const { user } = useAuth();

  if (!user) {
    return <SavedCollectionActionUnauthenticated {...props} />;
  }

  return <SavedCollectionActionAuthenticated {...props} />;
}

export function LibraryAction(props: CollectionActionProps) {
  return <SavedCollectionAction {...props} />;
}

export default function SavedCollectionActions(props: CollectionActionProps) {
  return <LibraryAction {...props} />;
}
