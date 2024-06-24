"use client";

import BottleForm from "@peated/web/components/bottleForm";
import { useModRequired } from "@peated/web/hooks/useAuthRequired";
import { trpc } from "@peated/web/lib/trpc";
import { revalidatePath } from "next/cache";
import { useRouter } from "next/navigation";

export default function MergeBottle({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  useModRequired();

  const [bottle] = trpc.bottleById.useSuspenseQuery(Number(bottleId));
  const trpcUtils = trpc.useUtils();

  const router = useRouter();

  const bottleUpdateMutation = trpc.bottleUpdate.useMutation({
    onSuccess: (data) => {
      if (!data) return;
      const previous = trpcUtils.bottleById.getData(data.id);
      if (previous) {
        trpcUtils.bottleById.setData(data.id, {
          ...previous,
          ...data,
        });
      }
    },
  });

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
              revalidatePath(`/bottles/${bottleId}`);
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
