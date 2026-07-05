import Button from "@peated/web/components/button";
import EntityHeader from "@peated/web/components/entityHeader";
import ShareButton from "@peated/web/components/shareButton";
import { summarize } from "@peated/web/lib/markdown";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import { getCanonicalRouteRedirectPath } from "@peated/web/lib/tombstoneRedirect";
import { redirect } from "next/navigation";
import { type ReactNode } from "react";
import type { Organization, WithContext } from "schema-dts";
import ModActions from "./modActions";

export async function generateMetadata(props: {
  params: Promise<{ entityId: string }>;
}) {
  const params = await props.params;

  const { entityId } = params;

  const { client } = await getAnonymousServerClient();

  const entity = await resolveOrNotFound(
    client.entities.details({
      entity: Number(entityId),
    }),
  );

  const description = summarize(entity.description || "", 200);

  return {
    title: entity.name,
    description,
    openGraph: {
      title: entity.name,
      description: description,
    },
    twitter: {
      card: "product",
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

  const entityId = Number(params.entityId);
  const entity = await resolveOrNotFound(
    client.entities.details({
      entity: entityId,
    }),
  );

  // tombstone path - redirect to the absolute url to ensure search engines dont get mad
  if (entity.id !== entityId) {
    return redirect(
      await getCanonicalRouteRedirectPath({
        currentId: entityId,
        canonicalId: entity.id,
        collectionPath: "/entities",
      }),
    );
  }

  const jsonLd: WithContext<Organization> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: entity.name,
    description: entity.description ?? undefined,
    // url: `/entities/${entity.id}`,
    address: entity.country
      ? [
          {
            "@type": "PostalAddress",
            streetAddress: entity.address ?? undefined,
            addressCountry: entity.country.name ?? undefined,
          },
        ]
      : [],
  };
  const createBottleParams = new URLSearchParams({
    returnTo: `/entities/${entityId}`,
  });
  if (entity.type.includes("brand"))
    createBottleParams.set("brand", `${entity.id}`);
  if (entity.type.includes("distiller"))
    createBottleParams.set("distiller", `${entity.id}`);
  if (entity.type.includes("bottler"))
    createBottleParams.set("bottler", `${entity.id}`);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="w-full p-3 lg:py-0">
        <EntityHeader entity={entity} />

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex-auto">
            <div className="my-8 flex justify-center gap-4 lg:justify-start">
              <Button
                href={`/bottles/new?${createBottleParams.toString()}`}
                color="primary"
              >
                Create Bottle
              </Button>

              <ShareButton title={entity.name} url={`/entities/${entity.id}`} />

              <ModActions entity={entity} />
            </div>
          </div>
        </div>
      </div>

      {children}
    </>
  );
}
