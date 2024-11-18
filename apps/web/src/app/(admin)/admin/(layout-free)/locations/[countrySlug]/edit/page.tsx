"use client";
import { use } from "react";

import CountryForm from "@peated/web/components/admin/countryForm";
import { useModRequired } from "@peated/web/hooks/useAuthRequired";
import { trpc } from "@peated/web/lib/trpc/client";
import { useRouter, useSearchParams } from "next/navigation";

export default function Page(props: {
  params: Promise<{ countrySlug: string }>;
}) {
  const params = use(props.params);

  const { countrySlug } = params;

  useModRequired();

  const [country] = trpc.countryBySlug.useSuspenseQuery(countrySlug);
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const trpcUtils = trpc.useUtils();

  const countryUpdateMutation = trpc.countryUpdate.useMutation({
    onSuccess: (data) => {
      if (!data) return;
      const previous = trpcUtils.countryBySlug.getData(data.slug);
      if (previous) {
        trpcUtils.countryBySlug.setData(data.slug, {
          ...previous,
          ...data,
        });
      }
    },
  });

  return (
    <CountryForm
      onSubmit={async (data) => {
        await countryUpdateMutation.mutateAsync(
          {
            ...data,
            slug: country.slug,
          },
          {
            onSuccess: (result) => {
              if (returnTo) router.push(returnTo);
              else router.replace(`/locations/${result.slug}`);
            },
          },
        );
      }}
      edit
      initialData={country}
      title="Edit Location"
    />
  );
}
