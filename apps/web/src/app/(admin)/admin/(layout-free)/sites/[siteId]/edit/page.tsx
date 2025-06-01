"use client";

import type { ExternalSiteType } from "@peated/server/types";
import SiteForm from "@peated/web/components/admin/siteForm";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function Page({
  params: { siteId },
}: {
  params: { siteId: ExternalSiteType };
}) {
  const orpc = useORPC();
  const { data: site } = useSuspenseQuery(
    orpc.externalSites.details.queryOptions({
      input: {
        site: siteId as any,
      },
    })
  );

  const router = useRouter();
  const siteUpdateMutation = useMutation(
    orpc.externalSites.update.mutationOptions()
  );

  return (
    <SiteForm
      onSubmit={async (data) => {
        const newSite = await siteUpdateMutation.mutateAsync({
          ...data,
          site: site.type,
        });
        router.push(`/admin/sites/${newSite.type}`);
      }}
      edit
      title="Edit Site"
      initialData={site}
    />
  );
}
