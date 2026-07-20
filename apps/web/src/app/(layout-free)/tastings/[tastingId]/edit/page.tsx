"use client";
import { use } from "react";

import type { Tasting } from "@peated/server/types";
import { useFlashMessages } from "@peated/web/components/flash";
import TastingForm, {
  type TastingEditFormSubmitData,
} from "@peated/web/components/tastingForm";
import { AuthRequired } from "@peated/web/hooks/useAuthRequired";
import { toBlob } from "@peated/web/lib/blobs";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function Page(props: {
  params: Promise<{ tastingId: string }>;
}) {
  const params = use(props.params);

  const { tastingId } = params;

  return (
    <AuthRequired>
      <TastingEditForm tastingId={tastingId} />
    </AuthRequired>
  );
}

function TastingEditForm({ tastingId }: { tastingId: string }) {
  const orpc = useORPC();

  const { data: tasting } = useSuspenseQuery(
    orpc.tastings.details.queryOptions({
      input: { tasting: Number(tastingId) },
    }),
  );

  const router = useRouter();

  const tastingUpdateMutation = useMutation(
    orpc.tastings.update.mutationOptions(),
  );
  const tastingImageUpdateMutation = useMutation(
    orpc.tastings.imageUpdate.mutationOptions(),
  );
  const { flash } = useFlashMessages();

  async function submitTastingUpdate({
    image,
    ...data
  }: TastingEditFormSubmitData) {
    await tastingUpdateMutation.mutateAsync({
      tasting: tasting.id,
      image: image === null ? null : undefined,
      ...data,
    });

    if (image) {
      try {
        await tastingImageUpdateMutation.mutateAsync({
          tasting: tasting.id,
          file: image instanceof File ? image : await toBlob(image),
        });
      } catch (err) {
        logError(err);
        flash(
          "There was an error uploading your image, but the tasting was saved.",
          "error",
        );
      }
    }
    router.push(`/tastings/${tasting.id}`);
  }

  return <TastingEditFields tasting={tasting} onSubmit={submitTastingUpdate} />;
}

function TastingEditFields({
  tasting,
  onSubmit,
}: {
  tasting: Tasting;
  onSubmit: (data: TastingEditFormSubmitData) => Promise<void>;
}) {
  return tasting.target.kind === "bottle" ? (
    <ExactTastingEditFields
      tasting={tasting}
      bottleId={tasting.target.bottle.id}
      onSubmit={onSubmit}
    />
  ) : (
    <GenericTastingEditFields tasting={tasting} onSubmit={onSubmit} />
  );
}

function ExactTastingEditFields({
  tasting,
  bottleId,
  onSubmit,
}: {
  tasting: Tasting;
  bottleId: number;
  onSubmit: (data: TastingEditFormSubmitData) => Promise<void>;
}) {
  const orpc = useORPC();
  const { data: suggestedTags } = useSuspenseQuery(
    orpc.bottles.suggestedTags.queryOptions({ input: { bottle: bottleId } }),
  );

  return (
    <TastingForm
      mode="edit"
      title="Edit Tasting"
      initialData={tasting}
      suggestedTags={suggestedTags}
      onSubmit={onSubmit}
    />
  );
}

function GenericTastingEditFields({
  tasting,
  onSubmit,
}: {
  tasting: Tasting;
  onSubmit: (data: TastingEditFormSubmitData) => Promise<void>;
}) {
  return (
    <TastingForm
      mode="edit"
      title="Edit Tasting"
      initialData={tasting}
      suggestedTags={{ results: tasting.target.group.suggestedTags }}
      onSubmit={onSubmit}
    />
  );
}
