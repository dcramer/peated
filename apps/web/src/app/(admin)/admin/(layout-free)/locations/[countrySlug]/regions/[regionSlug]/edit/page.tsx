"use client";

import RegionForm from "@peated/web/components/admin/regionForm";
import { useModRequired } from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";

export default function Page({
  params: { countrySlug, regionSlug },
}: {
  params: { countrySlug: string; regionSlug: string };
}) {
  useModRequired();

  const orpc = useORPC();
  const { data: region } = useSuspenseQuery(
    orpc.regions.details.queryOptions({
      input: {
        country: countrySlug,
        region: regionSlug,
      },
    })
  );

  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const queryClient = useQueryClient();

  const regionUpdateMutation = useMutation(
    orpc.regions.update.mutationOptions({
      onSuccess: (data) => {
        if (!data) return;
        // TODO: this might be wrong
        queryClient.setQueryData(
          orpc.regions.details.key({
            input: {
              country: countrySlug,
              region: data.slug,
            },
          }),
          (oldData: any) =>
            oldData
              ? {
                  ...oldData,
                  ...data,
                }
              : oldData
        );
      },
    })
  );

  return (
    <RegionForm
      onSubmit={async (data) => {
        await regionUpdateMutation.mutateAsync(
          {
            ...data,
            country: region.country.slug,
            region: region.slug,
          },
          {
            onSuccess: (result) => {
              if (returnTo) router.push(returnTo);
              else
                router.replace(
                  `/locations/${result.country.slug}/regions/${result.slug}`
                );
            },
          }
        );
      }}
      edit
      initialData={region}
      title="Edit Region"
    />
  );
}
