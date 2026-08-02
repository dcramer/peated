"use client";
import { use } from "react";

import RegionForm from "@peated/web/components/admin/regionForm";
import { ModRequired } from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import { formQueryOptions } from "@peated/web/lib/orpc/query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";

export default function Page(props: {
  params: Promise<{ countrySlug: string; regionSlug: string }>;
}) {
  const params = use(props.params);

  const { countrySlug, regionSlug } = params;

  return (
    <ModRequired>
      <RegionEditForm countrySlug={countrySlug} regionSlug={regionSlug} />
    </ModRequired>
  );
}

function RegionEditForm({
  countrySlug,
  regionSlug,
}: {
  countrySlug: string;
  regionSlug: string;
}) {
  const orpc = useORPC();
  const { data: region } = useSuspenseQuery(
    formQueryOptions(
      orpc.regions.details.queryOptions({
        input: {
          country: countrySlug,
          region: regionSlug,
        },
      }),
    ),
  );

  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const regionUpdateMutation = useMutation(
    orpc.regions.update.mutationOptions(),
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
              const canonicalPath = `/locations/${result.country.slug}/regions/${result.slug}`;
              const identityChanged =
                result.slug !== region.slug ||
                result.country.slug !== region.country.slug;
              if (identityChanged) router.replace(canonicalPath);
              else if (returnTo) router.push(returnTo);
              else router.replace(canonicalPath);
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
