"use client";

import { Button, ButtonLink } from "@peated/web/components/button.stylex";
import { SectionError } from "@peated/web/components/feedback.stylex";
import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import useAuth from "@peated/web/hooks/useAuth";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

export function AuctionWatch({ bottleId }: { bottleId: number }) {
  const { user } = useAuth();
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { flash } = useFlashMessages();
  const options = orpc.auctions.watch.queryOptions({
    input: { bottle: bottleId },
    enabled: !!user,
  });
  // Watch controls own user-specific cache entries; changing accounts must not reuse another watch.
  const queryKey = [...options.queryKey, user?.id];
  const watch = useQuery(queryOptions({ ...options, queryKey }));
  const mutation = useMutation(
    orpc.auctions.updateWatch.mutationOptions({
      onSuccess: (data) => queryClient.setQueryData(queryKey, data),
      onError: (error) =>
        flash(
          getFormErrorMessage(error, {
            fallbackMessage: "We couldn't save your auction watch. Try again.",
          }),
          "error",
        ),
    }),
  );
  if (!user)
    return (
      <ButtonLink
        href={`/login?redirectTo=${encodeURIComponent(`/bottles/${bottleId}/auctions`)}`}
        size="sm"
      >
        Sign in to watch auctions
      </ButtonLink>
    );
  if (watch.isError)
    return (
      <SectionError
        heading="Auction watch unavailable"
        onRetry={() => void watch.refetch()}
      >
        We couldn't load your watch. Try again.
      </SectionError>
    );
  return (
    <Button
      size="sm"
      disabled={watch.isPending || mutation.isPending}
      loading={watch.isPending || mutation.isPending}
      aria-pressed={watch.data?.watching ?? false}
      onClick={() =>
        mutation.mutate({ bottle: bottleId, watching: !watch.data?.watching })
      }
    >
      {watch.data?.watching ? "Stop watching auctions" : "Watch new auctions"}
    </Button>
  );
}
