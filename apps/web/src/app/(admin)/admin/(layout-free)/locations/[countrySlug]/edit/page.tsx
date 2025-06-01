"use client";

import CountryForm from "@peated/web/components/admin/countryForm";
import { useModRequired } from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";

export default function Page({
  params: { countrySlug },
}: {
  params: { countrySlug: string };
}) {
  useModRequired();

  const orpc = useORPC();
  const { data: country } = useSuspenseQuery(
    orpc.countries.details.queryOptions({
      input: { country: countrySlug },
    })
  );

  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const queryClient = useQueryClient();

  const countryUpdateMutation = useMutation(
    orpc.countries.update.mutationOptions({
      onSuccess: (data) => {
        if (!data) return;
        // TODO: this might be wrong
        queryClient.setQueryData(
          orpc.countries.details.key({
            input: { country: data.slug },
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
    <CountryForm
      onSubmit={async (data) => {
        await countryUpdateMutation.mutateAsync(
          {
            ...data,
            country: country.slug,
          },
          {
            onSuccess: (result) => {
              if (returnTo) router.push(returnTo);
              else router.replace(`/locations/${result.slug}`);
            },
          }
        );
      }}
      edit
      initialData={country}
      title="Edit Location"
    />
  );
}
