"use client";

import { toTitleCase } from "@peated/server/lib/strings";
import ReleaseForm from "@peated/web/components/releaseForm";
import Spinner from "@peated/web/components/spinner";
import useAuth from "@peated/web/hooks/useAuth";
import { useVerifiedRequired } from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { redirect, useRouter, useSearchParams } from "next/navigation";

export default function AddRelease({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  useVerifiedRequired();

  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const name = toTitleCase(searchParams.get("name") || "");
  const returnTo = searchParams.get("returnTo");
  const proposalId = searchParams.get("proposal");
  const canReviewProposal = !!(user?.mod || user?.admin);

  if (proposalId && user && !canReviewProposal) {
    redirect("/errors/unauthorized");
  }

  const orpc = useORPC();
  const { data: bottle } = useSuspenseQuery(
    orpc.bottles.details.queryOptions({ input: { bottle: Number(bottleId) } }),
  );
  const proposalQuery = useQuery({
    ...orpc.prices.matchQueue.details.queryOptions({
      input: { proposal: Number(proposalId) },
    }),
    enabled: !!proposalId && canReviewProposal,
  });

  const bottleReleaseCreateMutation = useMutation(
    orpc.bottleReleases.create.mutationOptions(),
  );
  const proposalCreateMutation = useMutation(
    orpc.prices.matchQueue.createBottle.mutationOptions(),
  );

  if (!bottle || (proposalId && proposalQuery.isLoading)) return <Spinner />;

  return (
    <ReleaseForm
      bottle={bottle}
      onSubmit={async ({ image, ...data }) => {
        const newRelease = proposalId
          ? await proposalCreateMutation.mutateAsync({
              proposal: Number(proposalId),
              release: data,
            })
          : await bottleReleaseCreateMutation.mutateAsync({
              bottle: Number(bottleId),
              ...data,
            });

        if (returnTo) router.push(returnTo);
        else router.replace(`/bottles/${bottleId}/releases`);
      }}
      initialData={{
        ...(proposalQuery.data?.proposedRelease || {}),
        edition: proposalQuery.data?.proposedRelease?.edition || name,
      }}
      title="Add Release"
    />
  );
}
