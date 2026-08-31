import { getEntityPage } from "@peated/web/lib/entityPage.server";
import { summarize } from "@peated/web/lib/markdown";
import { getServerClient } from "@peated/web/lib/orpc/client.server";
import type { ReactNode } from "react";
import type { Organization, WithContext } from "schema-dts";

import { EntityPageFrameClient } from "./entityPageFrameClient.stylex";

export async function generateMetadata(props: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await props.params;
  const entity = await getEntityPage(Number(entityId));
  const description = summarize(entity.description || "", 200);
  const primaryImage = entity.images?.[0];
  const images = primaryImage ? [primaryImage.imageUrl] : [];

  return {
    title: entity.name,
    description,
    openGraph: { title: entity.name, description, images },
    twitter: { card: "summary", images },
  };
}

export default async function EntityLayout(props: {
  children: ReactNode;
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await props.params;
  const canonicalEntity = await getEntityPage(Number(entityId));
  const { client } = await getServerClient();
  const entity = await client.entities.details({ entity: canonicalEntity.id });

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
