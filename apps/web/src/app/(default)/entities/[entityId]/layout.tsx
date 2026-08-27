import Button from "@peated/web/components/button";
import EntityHeader from "@peated/web/components/entityHeader";
import ShareButton from "@peated/web/components/shareButton";
import { getEntityPage } from "@peated/web/lib/entityPage.server";
import { summarize } from "@peated/web/lib/markdown";
import { getEntityUrl } from "@peated/web/lib/urls";
import { type ReactNode } from "react";
import type { Organization, WithContext } from "schema-dts";
import ModActions from "./modActions";

export async function generateMetadata(props: {
  params: Promise<{ entityId: string }>;
}) {
  const params = await props.params;

  const { entityId } = params;

  const entity = await getEntityPage(Number(entityId));

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
  params: Promise<{ entityId: string }>;
  children: ReactNode;
}) {
  const params = await props.params;

  const { children } = props;

  const entityId = Number(params.entityId);
  const entity = await getEntityPage(entityId);
  const entityUrl = getEntityUrl(entity);

  const jsonLd: WithContext<Organization> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: entity.name,
    description: entity.description ?? undefined,
    url: entityUrl,
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
    returnTo: entityUrl,
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

              <ShareButton title={entity.name} url={entityUrl} />

              <ModActions entity={entity} />
            </div>
          </div>
        </div>
      </div>

      {children}
    </>
  );
}
