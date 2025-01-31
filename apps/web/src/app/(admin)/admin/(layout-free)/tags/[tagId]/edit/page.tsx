"use client";
import { use } from "react";

import TagForm from "@peated/web/components/admin/tagForm";
import { trpc } from "@peated/web/lib/trpc/client";
import { useRouter } from "next/navigation";

export default function Page(props: { params: Promise<{ tagId: string }> }) {
  const params = use(props.params);

  const { tagId } = params;

  const [tag] = trpc.tagByName.useSuspenseQuery(tagId);

  const router = useRouter();
  const tagUpdateMutation = trpc.tagUpdate.useMutation();

  return (
    <TagForm
      onSubmit={async (data) => {
        const newTag = await tagUpdateMutation.mutateAsync({
          ...data,
          name: tag.name,
        });
        router.push(`/admin/tags/${newTag.name}`);
      }}
      edit
      title="Edit Tag"
      initialData={tag}
    />
  );
}
