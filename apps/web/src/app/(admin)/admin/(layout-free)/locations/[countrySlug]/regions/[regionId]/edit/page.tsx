"use client";

import RegionForm from "@peated/web/components/admin/regionForm";
import { useModRequired } from "@peated/web/hooks/useAuthRequired";
import { trpc } from "@peated/web/lib/trpc";
import { useRouter } from "next/navigation";

export default function Page({
  params: { countrySlug, regionSlug },
}: {
  params: { countrySlug: string; regionSlug: string };
}) {
  useModRequired();

  const [region] = trpc.regionBySlug.useSuspenseQuery({
    country: countrySlug,
    slug: regionSlug,
  });
  const router = useRouter();

  const trpcUtils = trpc.useUtils();

  const regionUpdateMutation = trpc.regionUpdate.useMutation({
    onSuccess: (data) => {
      if (!data) return;
      const previous = trpcUtils.regionBySlug.getData({
        country: countrySlug,
        slug: data.slug,
      });
      if (previous) {
        trpcUtils.regionBySlug.setData(
          {
            country: countrySlug,
            slug: data.slug,
          },
          {
            ...previous,
            ...data,
          },
        );
      }
    },
  });

  return (
    <RegionForm
      onSubmit={async (data) => {
        await regionUpdateMutation.mutateAsync(
          {
            ...data,
            country: region.country.slug,
            slug: region.slug,
          },
          {
            onSuccess: (result) => {
              router.push(
                `/locations/${result.country.slug}/regions/${result.slug}`,
              );
            },
          },
        );
      }}
      edit
      initialData={region}
      title="Edit Region"
    />
  );
}
