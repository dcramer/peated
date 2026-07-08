import { summarize } from "@peated/web/lib/markdown";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import { type ReactNode } from "react";
import BottleFullHeader from "../bottleFullHeader";
import BottleTabs from "../bottleTabs";

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

  const description = summarize(bottle.description || "", 200);
  const images = bottle.imageUrl ? [bottle.imageUrl] : [];

  return {
    title: bottle.fullName,
    description,
    images,
    openGraph: {
      title: bottle.fullName,
      description: description,
      images,
    },
    twitter: {
      card: "summary",
      images,
    },
  };
}

export default async function Layout(props: {
  params: Promise<Record<string, any>>;
  children: ReactNode;
}) {
  const params = await props.params;

  const { children } = props;

  const { client } = await getAnonymousServerClient();

  const bottleId = Number(params.bottleId);
  const bottle = await resolveOrNotFound(
    client.bottles.details({ bottle: bottleId }),
  );

  return (
    <>
      <BottleFullHeader bottle={bottle} />
      <BottleTabs bottle={bottle} />
      {children}
    </>
  );
}
