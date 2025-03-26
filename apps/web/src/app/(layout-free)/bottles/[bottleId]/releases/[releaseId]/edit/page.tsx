"use client";

import ReleaseForm from "@peated/web/components/releaseForm";
import { useModRequired } from "@peated/web/hooks/useAuthRequired";
import { trpc } from "@peated/web/lib/trpc/client";
import { useRouter } from "next/navigation";

export default function Page({
  params: { bottleId, releaseId },
}: {
  params: { bottleId: string; releaseId: string };
}) {
  useModRequired();

  const [bottle] = trpc.bottleById.useSuspenseQuery(Number(bottleId));
  const [release] = trpc.bottleReleaseById.useSuspenseQuery(Number(releaseId));
  const router = useRouter();
  const bottleReleaseUpdateMutation = trpc.bottleReleaseUpdate.useMutation();

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
