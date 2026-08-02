"use client";

import OAuthClientForm from "@peated/web/components/admin/oauthClientForm";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const orpc = useORPC();
  const create = useMutation(orpc.admin.oauthClients.create.mutationOptions());

  return (
    <OAuthClientForm
      onSubmit={async (data) => {
        const client = await create.mutateAsync(data);
        router.push(`/admin/oauth-clients/${client.clientId}`);
      }}
    />
  );
}
