"use client";

import { StarIcon as StarIconFilled } from "@heroicons/react/20/solid";
import { StarIcon } from "@heroicons/react/24/outline";
import { isDefinedError } from "@orpc/client";
import type { Bottle } from "@peated/server/types";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import useAuth from "../hooks/useAuth";
import { useORPC } from "../lib/orpc/context";
import Button from "./button";

function CollectionActionAuthenticated({ bottle }: { bottle: Bottle }) {
  const orpc = useORPC();
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
      orpc.collections.list.queryOptions({
        input: {
          bottle: bottle.id,
          user: "me",
        },
        select: (data) => data.results.length > 0,
      }),
    );
    isCollected = result.data;
    isLoading = result.isLoading;
  } catch (err: any) {
    if (isDefinedError(err) && err.data?.code === "UNAUTHORIZED") {
      return <CollectionActionUnauthenticated />;
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
              bottle: bottle.id,
              user: "me",
              collection: "default",
            })
          : favoriteBottleMutation.mutateAsync({
              bottle: bottle.id,
              user: "me",
              collection: "default",
            });
      }}
      disabled={isAnyLoading}
      color="primary"
    >
      {isCollected ? (
        <StarIconFilled className="text-highlight h-4 w-4" aria-hidden="true" />
      ) : (
        <StarIcon className="h-4 w-4" aria-hidden="true" />
      )}
    </Button>
  );
}

function CollectionActionUnauthenticated() {
  return (
    <Button href="/login" color="primary">
      <StarIcon className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}

export default function CollectionAction({ bottle }: { bottle: Bottle }) {
  const { user } = useAuth();

  if (!user) {
    return <CollectionActionUnauthenticated />;
  }

  return <CollectionActionAuthenticated bottle={bottle} />;
}
