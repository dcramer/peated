import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import { type ReactNode } from "react";

export async function generateMetadata(props: {
  params: Promise<{ entityId: string }>;
}) {
  const params = await props.params;

  const { entityId } = params;

  const { client } = await getAnonymousServerClient();

  const entity = await resolveOrNotFound(
    client.entities.details({
      entity: Number(entityId),
    }),
  );

  return {
    title: `Tastings for ${entity.name}`,
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
