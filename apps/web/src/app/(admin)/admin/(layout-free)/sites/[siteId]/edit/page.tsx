"use client";
import { use } from "react";

import { type ExternalSiteType } from "@peated/server/types";
import SiteForm from "@peated/web/components/admin/siteForm";
import { trpc } from "@peated/web/lib/trpc/client";
import { useRouter } from "next/navigation";

export default function Page(props: {
  params: Promise<{ siteId: ExternalSiteType }>;
}) {
  const params = use(props.params);

  const { siteId } = params;

  const [site] = trpc.externalSiteByType.useSuspenseQuery(siteId);

  const router = useRouter();
  const siteUpdateMutation = trpc.externalSiteUpdate.useMutation();

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
