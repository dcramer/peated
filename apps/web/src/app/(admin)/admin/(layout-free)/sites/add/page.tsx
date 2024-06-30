"use client";

import SiteForm from "@peated/web/components/admin/siteForm";
import { trpc } from "@peated/web/lib/trpc";
import { useRouter } from "next/navigation";

export const fetchCache = "default-no-store";

export const dynamic = "force-dynamic";

export default function Page() {
  const router = useRouter();
  const siteCreateMutation = trpc.externalSiteCreate.useMutation();

  return (
    <SiteForm
      onSubmit={async (data) => {
        const site = await siteCreateMutation.mutateAsync({
          ...data,
        });
        router.push(`/admin/sites/${site.type}`);
      }}
    />
  );
}
