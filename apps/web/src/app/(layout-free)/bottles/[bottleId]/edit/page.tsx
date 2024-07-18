"use client";

import BottleForm from "@peated/web/components/bottleForm";
import { useModRequired } from "@peated/web/hooks/useAuthRequired";
import { trpc } from "@peated/web/lib/trpc/client";
import { useRouter } from "next/navigation";

export default function Page({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  useModRequired();

  const [bottle] = trpc.bottleById.useSuspenseQuery(Number(bottleId));
  const router = useRouter();
  const bottleUpdateMutation = trpc.bottleUpdate.useMutation();

  return (
    <BottleForm
      onSubmit={async (data) => {
        await bottleUpdateMutation.mutateAsync(
          {
            bottle: bottle.id,
            ...data,
          },
          {
            onSuccess: () => {
              router.push(`/bottles/${bottleId}`);
            },
          },
        );
      }}
      initialData={bottle}
      title="Edit Bottle"
    />
  );
}
