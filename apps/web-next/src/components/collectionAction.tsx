import { StarIcon as StarIconFilled } from "@heroicons/react/20/solid";
import { StarIcon } from "@heroicons/react/24/outline";
import type { Bottle } from "@peated/server/types";
import { trpc } from "@peated/web/lib/trpc";
import Button from "./button";

export default function CollectionAction({ bottle }: { bottle: Bottle }) {
  const { data: isCollected, isLoading } = trpc.collectionList.useQuery(
    {
      bottle: bottle.id,
      user: "me",
    },
    {
      select: (data) => data.results.length > 0,
    },
  );

  const favoriteBottleMutation = trpc.collectionBottleCreate.useMutation();
  const unfavoriteBottleMutation = trpc.collectionBottleDelete.useMutation();

  if (isCollected === undefined) return null;

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
      disabled={isLoading}
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
