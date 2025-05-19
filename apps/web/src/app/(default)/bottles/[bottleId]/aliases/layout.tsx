import SimpleHeader from "@peated/web/components/simpleHeader";
import { client } from "@peated/web/lib/orpc/client";
import { type ReactNode } from "react";

export async function generateMetadata({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const bottle = await client.bottles.details({
    bottle: Number(bottleId),
  });

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
