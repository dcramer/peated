"use client";

import RegionForm from "@peated/web/components/admin/regionForm";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const params = useParams();
  const countrySlug = params.countrySlug as string;

  const orpc = useORPC();
  const regionCreateMutation = useMutation(
    orpc.regions.create.mutationOptions()
  );

  return (
    <RegionForm
      onSubmit={async (data) => {
        const region = await regionCreateMutation.mutateAsync({
          ...data,
          country: countrySlug,
        });
        router.push(
          `/admin/locations/${region.country.slug}/regions/${region.slug}`
        );
      }}
    />
  );
}
