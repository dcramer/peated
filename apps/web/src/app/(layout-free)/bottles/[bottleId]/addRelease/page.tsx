"use client";

import { use } from "react";

import BottleForm from "@peated/web/components/bottleForm";
import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import { WorkflowLoading } from "@peated/web/components/workflowScreen.stylex";
import useAuth from "@peated/web/hooks/useAuth";
import { VerifiedRequired } from "@peated/web/hooks/useAuthRequired";
import { buildBottleProposalDraft } from "@peated/web/lib/bottleProposalDraft";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { getBottleUrl } from "@peated/web/lib/urls";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { redirect, useRouter, useSearchParams } from "next/navigation";

export default function AddSimilarBottle(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const { bottleId } = use(props.params);

  return (
    <VerifiedRequired>
      <AddSimilarBottleForm bottleId={bottleId} />
    </VerifiedRequired>
  );
}

function AddSimilarBottleForm({ bottleId }: { bottleId: string }) {
  const { user } = useAuth();
  const orpc = useORPC();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const proposalId = searchParams.get("proposal");
  const canReviewProposal = !!(user?.mod || user?.admin);

  if (proposalId && user && !canReviewProposal) {
    redirect("/errors/unauthorized");
  }

  const { data: sourceBottle } = useSuspenseQuery(
    orpc.bottles.details.queryOptions({ input: { bottle: Number(bottleId) } }),
  );
  const proposalQuery = useQuery({
    ...orpc.prices.matchQueue.details.queryOptions({
      input: { proposal: Number(proposalId) },
    }),
    enabled: !!proposalId && canReviewProposal,
  });
  const bottleCreateMutation = useMutation(
    orpc.bottles.create.mutationOptions(),
  );
  const proposalBottleCreateMutation = useMutation(
    orpc.prices.matchQueue.createBottle.mutationOptions(),
  );
  const bottleImageUpdateMutation = useMutation(
    orpc.bottles.imageUpdate.mutationOptions(),
  );
  const { flash } = useFlashMessages();

  if (proposalId && proposalQuery.isLoading) {
    return (
      <WorkflowLoading
        label="Loading bottle proposal"
        title="Add a similar bottle"
      />
    );
  }
  if (!sourceBottle.group) {
    throw new Error("Adding a similar Bottle requires source Bottle details.");
  }

  const initialData = {
    ...buildBottleProposalDraft({
      sourceBottle,
      sourceSharedName: sourceBottle.group.name,
      proposedBottle: proposalQuery.data?.proposedBottle,
    }),
    imageUrl: proposalQuery.data?.price.imageUrl ?? undefined,
  };

  return (
    <BottleForm
      title="Add a similar bottle"
      saveLabel="Add a bottle"
      returnTo={returnTo}
      initialData={initialData}
      onSubmit={async ({ image, imageSourceUrl, imageLicense, ...data }) => {
        const createdBottle = proposalId
          ? await proposalBottleCreateMutation.mutateAsync({
              proposal: Number(proposalId),
              independentBottle: data,
            })
          : await bottleCreateMutation.mutateAsync(data);

        if (image) {
          try {
            await bottleImageUpdateMutation.mutateAsync({
              bottle: createdBottle.id,
              file: image,
              sourceUrl: imageSourceUrl,
              license: imageLicense,
            });
          } catch (error) {
            logError(error, {
              context: "add_another_release_image_upload",
              extra: { bottleId: createdBottle.id, sourceBottleId: bottleId },
            });
            flash(
              "We couldn't upload the image, but the bottle was saved. Try the image again.",
              "error",
            );
          }
        }

        if (returnTo) router.push(returnTo);
        else router.replace(getBottleUrl(createdBottle));
      }}
    />
  );
}
