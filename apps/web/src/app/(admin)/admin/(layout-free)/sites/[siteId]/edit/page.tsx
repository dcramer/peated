"use client";

import { type ExternalSiteType } from "@peated/server/types";
import TagForm from "@peated/web/components/admin/tagForm";
import { trpc } from "@peated/web/lib/trpc";
import { useRouter } from "next/navigation";

export const fetchCache = "default-no-store";

export const dynamic = "force-dynamic";

export default function Page({
  params: { siteId },
}: {
  params: { siteId: ExternalSiteType };
}) {
  const [site] = trpc.externalSiteByType.useSuspenseQuery(siteId);

  const router = useRouter();
  const siteUpdateMutation = trpc.externalSiteUpdate.useMutation();

  return (
    <TagForm
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
