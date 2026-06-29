import SimpleHeader from "@peated/web/components/simpleHeader";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import { type ReactNode } from "react";

export async function generateMetadata({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const { client } = await getAnonymousServerClient();

  const entity = await resolveOrNotFound(
    client.entities.details({ entity: Number(entityId) }),
  );

  return {
    title: `Other Names for ${entity.name}`,
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <SimpleHeader as="h2">Aliases</SimpleHeader>
      {children}
    </>
  );
}
