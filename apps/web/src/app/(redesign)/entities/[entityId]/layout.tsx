import { summarize } from "@peated/web/lib/markdown";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import { getCanonicalRouteRedirectPath } from "@peated/web/lib/tombstoneRedirect";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import type { Organization, WithContext } from "schema-dts";

import { EntityPageFrameClient } from "./entityPageFrameClient.stylex";

export async function generateMetadata(props: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await props.params;
  const { client } = await getAnonymousServerClient();
  const entity = await resolveOrNotFound(
    client.entities.details({ entity: Number(entityId) }),
  );
  const description = summarize(entity.description || "", 200);

  return {
    title: entity.name,
    description,
    openGraph: { title: entity.name, description },
    twitter: { card: "summary" },
  };
}

export default async function EntityLayout(props: {
  children: ReactNode;
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await props.params;
  const requestedId = Number(entityId);
  const { client } = await getAnonymousServerClient();
  const entity = await resolveOrNotFound(
    client.entities.details({ entity: requestedId }),
  );

  if (entity.id !== requestedId) {
    return redirect(
      await getCanonicalRouteRedirectPath({
        currentId: requestedId,
        canonicalId: entity.id,
        collectionPath: "/entities",
      }),
    );
  }

  const owner = entity.ownerId
    ? await resolveOrNotFound(
        client.entities.details({ entity: entity.ownerId }),
      )
    : null;
  const jsonLd: WithContext<Organization> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: entity.name,
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
      <EntityPageFrameClient initialEntity={entity} owner={owner}>
        {props.children}
      </EntityPageFrameClient>
    </>
  );
}
