"use client";

import ReleaseForm from "@peated/web/components/releaseForm";
import { useModRequired } from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function Page({
  params: { bottleId, releaseId },
}: {
  params: { bottleId: string; releaseId: string };
}) {
  useModRequired();

  const orpc = useORPC();
  const { data: bottle } = useSuspenseQuery(
    orpc.bottles.details.queryOptions({ input: { bottle: Number(bottleId) } }),
  );
  const { data: release } = useSuspenseQuery(
    orpc.bottleReleases.details.queryOptions({
      input: { release: Number(releaseId) },
    }),
  );
  const router = useRouter();
  const bottleReleaseUpdateMutation = useMutation(
    orpc.bottleReleases.update.mutationOptions(),
  );

  return (
    <ReleaseForm
      bottle={bottle}
      onSubmit={async (data) => {
        await bottleReleaseUpdateMutation.mutateAsync({
          release: release.id,
          ...data,
        });

        router.push(`/bottles/${bottleId}/releases`);
      }}
      initialData={release}
      title="Edit Bottle Release"
    />
  );
}
