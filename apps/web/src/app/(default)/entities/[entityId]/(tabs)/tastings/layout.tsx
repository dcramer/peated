import { getServerClient } from "@peated/web/lib/orpc/client.server";
import type { ReactNode } from "react";

export async function generateMetadata({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const { client } = await getServerClient();

  const entity = await client.entities.details({
    entity: Number(entityId),
  });

  return {
    title: `Tastings for ${entity.name}`,
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
