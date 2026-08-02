"use client";

import OAuthClientForm from "@peated/web/components/admin/oauthClientForm";
import { useORPC } from "@peated/web/lib/orpc/context";
import { formQueryOptions } from "@peated/web/lib/orpc/query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { use } from "react";

export default function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = use(params);
  const router = useRouter();
  const orpc = useORPC();
  const { data: client } = useSuspenseQuery(
    formQueryOptions(
      orpc.admin.oauthClients.details.queryOptions({ input: { clientId } }),
    ),
  );
  const update = useMutation(orpc.admin.oauthClients.update.mutationOptions());

  return (
    <OAuthClientForm
      title="Edit OAuth Client"
      initialData={client}
      onSubmit={async (data) => {
        const updated = await update.mutateAsync({ clientId, ...data });
        router.push(`/admin/oauth-clients/${updated.clientId}`);
      }}
    />
  );
}
