"use client";

import RegionForm from "@peated/web/components/admin/regionForm";
import { trpc } from "@peated/web/lib/trpc";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const regionCreateMutation = trpc.regionCreate.useMutation();

  return (
    <RegionForm
      onSubmit={async (data) => {
        const region = await regionCreateMutation.mutateAsync({
          ...data,
        });
        router.push(
          `/admin/locations/${region.country.slug}/regions/${region.slug}`,
        );
      }}
    />
  );
}
