"use client";

import TagForm from "@peated/web/components/admin/tagForm";
import { trpc } from "@peated/web/lib/trpc";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const tagCreateMutation = trpc.tagCreate.useMutation();

  return (
    <TagForm
      onSubmit={async (data) => {
        const tag = await tagCreateMutation.mutateAsync({
          ...data,
        });
        router.push(`/admin/tags/${tag.name}`);
      }}
    />
  );
}
