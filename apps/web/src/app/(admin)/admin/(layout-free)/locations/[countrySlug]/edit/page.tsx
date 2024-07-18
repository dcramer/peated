"use client";

import CountryForm from "@peated/web/components/admin/countryForm";
import { useModRequired } from "@peated/web/hooks/useAuthRequired";
import { trpc } from "@peated/web/lib/trpc/client";
import { useRouter } from "next/navigation";

export default function Page({
  params: { countrySlug },
}: {
  params: { countrySlug: string };
}) {
  useModRequired();

  const [country] = trpc.countryBySlug.useSuspenseQuery(countrySlug);
  const router = useRouter();

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
            onSuccess: () => {
              router.push(`/locations/${country.slug}`);
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
