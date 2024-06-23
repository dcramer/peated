"use client";

import { StarIcon as StarIconFilled } from "@heroicons/react/20/solid";
import { StarIcon } from "@heroicons/react/24/outline";
import type { Bottle } from "@peated/server/types";
import { isTRPCClientError, trpc } from "@peated/web/lib/trpc";
import useAuth from "../hooks/useAuth";
import Button from "./button";

export default function CollectionAction({ bottle }: { bottle: Bottle }) {
  const { user } = useAuth();

  if (!user) {
    return (
      <Button href="/login" color="primary">
        <StarIcon className="h-4 w-4" aria-hidden="true" />
      </Button>
    );
  }

  let isCollected = false;
  let isLoading = false;
  try {
    const [result, collectedQuery] = trpc.collectionList.useSuspenseQuery(
      {
        bottle: bottle.id,
        user: "me",
      },
      {
        select: (data) => data.results.length > 0,
      },
    );
    isCollected = result;
    isLoading = collectedQuery.isLoading;
  } catch (err) {
    if (isTRPCClientError(err) && err.data?.code === "UNAUTHORIZED") {
      return (
        <Button href="/login" color="primary">
          <StarIcon className="h-4 w-4" aria-hidden="true" />
        </Button>
      );
    }
    throw err;
  }

  const favoriteBottleMutation = trpc.collectionBottleCreate.useMutation();
  const unfavoriteBottleMutation = trpc.collectionBottleDelete.useMutation();

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
