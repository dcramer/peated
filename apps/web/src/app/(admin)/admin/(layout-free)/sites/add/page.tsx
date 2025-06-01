"use client";

import SiteForm from "@peated/web/components/admin/siteForm";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const orpc = useORPC();
  const siteCreateMutation = useMutation(
    orpc.externalSites.create.mutationOptions()
  );

  return (
    <SiteForm
      onSubmit={async (data) => {
        const site = await siteCreateMutation.mutateAsync(data);
        router.push(`/admin/sites/${site.type}`);
      }}
    />
  );
}
