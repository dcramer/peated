import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { serializeBottleStructuredData } from "@peated/web/lib/catalogStructuredData";
import { getServerClient } from "@peated/web/lib/orpc/client.server";
import { getBottleSeoMetadata } from "@peated/web/lib/seoMetadata";
import { getSession } from "@peated/web/lib/session.server";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { BottlePageFrameClient } from "./bottlePageClient.stylex";

export async function generateMetadata(props: {
  params: Promise<{ bottleId: string }>;
}): Promise<Metadata> {
  const { bottleId } = await props.params;
  const bottle = await getBottlePage(parseCatalogRouteId(bottleId));
  return getBottleSeoMetadata(bottle);
}

export default async function BottleLayout(props: {
  children: ReactNode;
  params: Promise<{ bottleId: string }>;
}) {
  const { bottleId } = await props.params;
  const canonicalBottle = await getBottlePage(parseCatalogRouteId(bottleId));
  const session = await getSession();
  // BottleLayout reuses public details; only members need a second read for their state.
  let bottle = canonicalBottle;
  if (session.accessToken) {
    const { client } = await getServerClient();
    bottle = await client.bottles.details({ bottle: canonicalBottle.id });
  }
  const structuredData = serializeBottleStructuredData(bottle);

  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: structuredData }}
        type="application/ld+json"
      />
      <BottlePageFrameClient initialBottle={bottle}>
        {props.children}
      </BottlePageFrameClient>
    </>
  );
}
