import SimpleHeader from "@peated/web/components/simpleHeader";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import { type ReactNode } from "react";

export async function generateMetadata(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const params = await props.params;

  const { bottleId } = params;

  const { client } = await getAnonymousServerClient();
  const bottle = await resolveOrNotFound(
    client.bottles.details({
      bottle: Number(bottleId),
    }),
  );

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
