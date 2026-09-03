import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getEntityPage } from "@peated/web/lib/entityPage.server";
import { getServerClient } from "@peated/web/lib/orpc/client.server";
import { getEntitySeoMetadata } from "@peated/web/lib/seoMetadata";
import { getSession } from "@peated/web/lib/session.server";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import type { Organization, WithContext } from "schema-dts";

import { EntityPageFrameClient } from "./entityPageFrameClient.stylex";

export async function generateMetadata(props: {
  params: Promise<{ entityId: string }>;
}): Promise<Metadata> {
  const { entityId } = await props.params;
  const entity = await getEntityPage(parseCatalogRouteId(entityId));
  return getEntitySeoMetadata(entity);
}

export default async function EntityLayout(props: {
  children: ReactNode;
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await props.params;
  const canonicalEntity = await getEntityPage(parseCatalogRouteId(entityId));
  const session = await getSession();
  // EntityLayout reuses public details; only members need a second read for following state.
  let entity = canonicalEntity;
  if (session.accessToken) {
    const { client } = await getServerClient();
    entity = await client.entities.details({ entity: canonicalEntity.id });
  }

  const jsonLd: WithContext<Organization> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: entity.name,
    image: entity.images?.[0]?.imageUrl,
    description: entity.description ?? undefined,
    address: entity.country
      ? [
          {
            "@type": "PostalAddress",
            streetAddress: entity.address ?? undefined,
            addressCountry: entity.country.name,
          },
        ]
      : [],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EntityPageFrameClient initialEntity={entity}>
        {props.children}
      </EntityPageFrameClient>
    </>
  );
}
