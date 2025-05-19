"use client";

import { toTitleCase } from "@peated/server/lib/strings";
import ReleaseForm from "@peated/web/components/releaseForm";
import { useVerifiedRequired } from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
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

  const orpc = useORPC();
  const { data: bottle } = useSuspenseQuery(
    orpc.bottles.details.queryOptions({ input: { bottle: Number(bottleId) } }),
  );

  const bottleReleaseCreateMutation = useMutation(
    orpc.bottles.releases.create.mutationOptions(),
  );

  if (!bottle) return null;

  return (
    <ReleaseForm
      bottle={bottle}
      onSubmit={async ({ image, ...data }) => {
        const newRelease = await bottleReleaseCreateMutation.mutateAsync({
          bottle: Number(bottleId),
          ...data,
        });

        if (returnTo) router.push(returnTo);
        else router.replace(`/bottles/${bottleId}/releases`);
      }}
      initialData={{
        edition: name,
      }}
      title="Add Release"
    />
  );
}
