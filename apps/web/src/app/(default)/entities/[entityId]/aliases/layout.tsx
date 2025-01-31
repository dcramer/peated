import SimpleHeader from "@peated/web/components/simpleHeader";
import { getTrpcClient } from "@peated/web/lib/trpc/client.server";
import { type ReactNode } from "react";

export async function generateMetadata(props: {
  params: Promise<{ entityId: string }>;
}) {
  const params = await props.params;

  const { entityId } = params;

  const trpcClient = await getTrpcClient();
  const entity = await trpcClient.entityById.fetch(Number(entityId));

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
