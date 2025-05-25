"use client";

import TagForm from "@peated/web/components/admin/tagForm";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function Page({
  params: { tagId },
}: {
  params: { tagId: string };
}) {
  const orpc = useORPC();
  const { data: tag } = useSuspenseQuery(
    orpc.tags.details.queryOptions({
      input: {
        tag: tagId,
      },
    }),
  );

  const router = useRouter();
  const tagUpdateMutation = useMutation(orpc.tags.update.mutationOptions());

  return (
    <TagForm
      onSubmit={async (data) => {
        const newTag = await tagUpdateMutation.mutateAsync({
          ...data,
          tag: tag.name,
        });
        router.push(`/admin/tags/${newTag.name}`);
      }}
      edit
      title="Edit Tag"
      initialData={tag}
    />
  );
}
