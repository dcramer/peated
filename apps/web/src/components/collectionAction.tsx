"use client";

import { StarIcon as StarIconFilled } from "@heroicons/react/20/solid";
import { StarIcon } from "@heroicons/react/24/outline";
import { isDefinedError } from "@orpc/client";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import useAuth from "../hooks/useAuth";
import { useORPC } from "../lib/orpc/context";
import Button from "./button";

type CollectionActionProps = {
  bottleId: number;
  releaseId?: number | null;
  size?: "small" | "base";
  title?: string;
};

function CollectionActionAuthenticated({
  bottleId,
  releaseId,
  size,
  title,
}: CollectionActionProps) {
  const orpc = useORPC();
  const baseOnly = releaseId == null;
  const resolvedTitle =
    title ?? (baseOnly ? "Save Bottle" : "Save Specific Bottling");
  const favoriteBottleMutation = useMutation(
    orpc.collections.bottles.create.mutationOptions(),
  );
  const unfavoriteBottleMutation = useMutation(
    orpc.collections.bottles.delete.mutationOptions(),
  );

  let isCollected = false;
  let isLoading = false;
  try {
    const result = useSuspenseQuery(
      orpc.collections.bottles.list.queryOptions({
        input: {
          user: "me",
          collection: "default",
          bottle: bottleId,
          release: releaseId ?? undefined,
          baseOnly,
        },
        select: (data) => data.results.length > 0,
      }),
    );
    isCollected = result.data;
    isLoading = result.isLoading;
  } catch (err: any) {
    if (isDefinedError(err) && err.data?.code === "UNAUTHORIZED") {
      return (
        <CollectionActionUnauthenticated size={size} title={resolvedTitle} />
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
        isCollected
          ? unfavoriteBottleMutation.mutateAsync({
              bottle: bottleId,
              release: releaseId,
              baseOnly,
              user: "me",
              collection: "default",
            })
          : favoriteBottleMutation.mutateAsync({
              bottle: bottleId,
              release: releaseId,
              user: "me",
              collection: "default",
            });
      }}
      disabled={isAnyLoading}
      color="primary"
      size={size}
      title={resolvedTitle}
    >
      {isCollected ? (
        <StarIconFilled className="text-highlight h-4 w-4" aria-hidden="true" />
      ) : (
        <StarIcon className="h-4 w-4" aria-hidden="true" />
      )}
    </Button>
  );
}

function CollectionActionUnauthenticated({
  size,
  title,
}: Pick<CollectionActionProps, "size" | "title">) {
  return (
    <Button href="/login" color="primary" size={size} title={title}>
      <StarIcon className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}

export default function CollectionAction(props: CollectionActionProps) {
  const { user } = useAuth();

  if (!user) {
    return <CollectionActionUnauthenticated {...props} />;
  }

  return <CollectionActionAuthenticated {...props} />;
}
