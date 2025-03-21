"use client";

import { toTitleCase } from "@peated/server/lib/strings";
import ReleaseForm from "@peated/web/components/releaseForm";
import { useVerifiedRequired } from "@peated/web/hooks/useAuthRequired";
import { trpc } from "@peated/web/lib/trpc/client";
import { useRouter, useSearchParams } from "next/navigation";

export default function AddRelease({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  useVerifiedRequired();

  const router = useRouter();
  const searchParams = useSearchParams();
  const name = toTitleCase(searchParams.get("name") || "");
  const returnTo = searchParams.get("returnTo");

  const [bottle] = trpc.bottleById.useSuspenseQuery(Number(bottleId));

  const bottleReleaseCreateMutation = trpc.bottleReleaseCreate.useMutation();

  if (!bottle) return null;

  return (
    <ReleaseForm
      bottle={bottle}
      onSubmit={async ({ image, ...data }) => {
        const newRelease = await bottleReleaseCreateMutation.mutateAsync({
          bottleId: Number(bottleId),
          ...data,
        });

        if (returnTo) router.push(returnTo);
        else router.replace(`/bottles/${bottleId}/releases/${newRelease.id}`);
      }}
      initialData={{
        edition: name,
      }}
      title="Add Release"
    />
  );
}
