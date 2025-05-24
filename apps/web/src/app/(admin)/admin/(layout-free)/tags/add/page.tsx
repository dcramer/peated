"use client";

import TagForm from "@peated/web/components/admin/tagForm";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const orpc = useORPC();
  const tagCreateMutation = useMutation(orpc.tags.create.mutationOptions());

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
