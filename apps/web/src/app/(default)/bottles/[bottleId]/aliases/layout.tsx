import SimpleHeader from "@peated/web/components/simpleHeader";
import { getTrpcClient } from "@peated/web/lib/trpc/client.server";
import { type ReactNode } from "react";

export async function generateMetadata(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const params = await props.params;

  const { bottleId } = params;

  const trpcClient = await getTrpcClient();
  const bottle = await trpcClient.bottleById.fetch(Number(bottleId));

  return {
    title: `Other Names for ${bottle.fullName}`,
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
