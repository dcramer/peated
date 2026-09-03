"use client";

import { ReviewScoringForm } from "@peated/web/components/admin/reviewScoringForm.stylex";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";

export default function ReviewScoringSettings({ site }: { site: string }) {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const query = orpc.externalSites.reviewScoring.get.queryOptions({
    input: { site },
  });
  const { data: settings } = useSuspenseQuery({
    ...query,
    refetchInterval: ({ state }) =>
      state.data?.recomputePending ? 5000 : false,
  });
  const preview = useMutation(
    orpc.externalSites.reviewScoring.preview.mutationOptions(),
  );
  const update = useMutation(
    orpc.externalSites.reviewScoring.update.mutationOptions(),
  );
  return (
    <ReviewScoringForm
      key={settings.version}
      settings={settings}
      onPreview={(policy) => preview.mutateAsync({ site, policy })}
      onSave={async (policy, expectedVersion) => {
        const saved = await update.mutateAsync({
          site,
          policy,
          expectedVersion,
        });
        queryClient.setQueryData(query.queryKey, saved);
        await queryClient.invalidateQueries({
          queryKey: orpc.externalReviews.key(),
        });
      }}
    />
  );
}
