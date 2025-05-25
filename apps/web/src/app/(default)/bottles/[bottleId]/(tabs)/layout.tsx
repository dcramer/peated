import Link from "@peated/web/components/link";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import { summarize } from "@peated/web/lib/markdown";
import { getServerClient } from "@peated/web/lib/orpc/client.server";
import { type ReactNode } from "react";

export async function generateMetadata({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const { client } = await getServerClient();

  const bottle = await client.bottles.details({
    bottle: Number(bottleId),
  });

  const description = summarize(bottle.description || "", 200);

  return {
    title: bottle.fullName,
    description,
    images: [bottle.imageUrl],
    openGraph: {
      title: bottle.fullName,
      description: description,
      images: [bottle.imageUrl],
    },
    twitter: {
      card: "summary",
      images: [bottle.imageUrl],
    },
  };
}

export default async function Layout({
  params,
  children,
}: {
  params: Record<string, any>;
  children: ReactNode;
}) {
  const { client } = await getServerClient();

  const bottleId = Number(params.bottleId);
  const bottle = await client.bottles.details({ bottle: bottleId });

  const baseUrl = `/bottles/${bottle.id}`;

  return (
    <>
      <Tabs border>
        <TabItem as={Link} href={baseUrl} controlled>
          Overview
        </TabItem>
        <TabItem as={Link} href={`${baseUrl}/tastings`} controlled>
          Tastings ({bottle.totalTastings.toLocaleString()})
        </TabItem>
        <TabItem as={Link} href={`${baseUrl}/releases`} controlled>
          Releases ({bottle.numReleases.toLocaleString()})
        </TabItem>
        <TabItem as={Link} href={`${baseUrl}/prices`} controlled desktopOnly>
          Prices
        </TabItem>
        <TabItem as={Link} href={`${baseUrl}/similar`} controlled desktopOnly>
          Similar
        </TabItem>
      </Tabs>
      {children}
    </>
  );
}
