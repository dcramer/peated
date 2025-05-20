import SimpleHeader from "@peated/web/components/simpleHeader";
import { client } from "@peated/web/lib/orpc/client";
import { type ReactNode } from "react";

export async function generateMetadata({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const entity = await client.entities.details({ entity: Number(entityId) });

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
