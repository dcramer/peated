import SimpleHeader from "@peated/web/components/simpleHeader";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import { type ReactNode } from "react";
import BottleFullHeader from "../bottleFullHeader";

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

export default async function Layout(props: {
  params: Promise<{ bottleId: string }>;
  children: ReactNode;
}) {
  const params = await props.params;
  const { children } = props;

  const { client } = await getAnonymousServerClient();
  const bottle = await resolveOrNotFound(
    client.bottles.details({
      bottle: Number(params.bottleId),
    }),
  );

  return (
    <>
      <BottleFullHeader bottle={bottle} />
      <SimpleHeader as="h2">Aliases</SimpleHeader>
      {children}
    </>
  );
}
