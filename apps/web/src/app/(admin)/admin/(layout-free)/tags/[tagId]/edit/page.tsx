"use client";
import { use } from "react";

import TagForm from "@peated/web/components/admin/tagForm";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function Page(props: { params: Promise<{ tagId: string }> }) {
  const params = use(props.params);

  const { tagId } = params;

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
