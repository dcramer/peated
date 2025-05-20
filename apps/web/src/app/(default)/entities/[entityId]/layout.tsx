import Button from "@peated/web/components/button";
import EntityHeader from "@peated/web/components/entityHeader";
import ShareButton from "@peated/web/components/shareButton";
import { getServerClient } from "@peated/web/lib/orpc/client.server";
import { redirect } from "next/navigation";
import { type ReactNode } from "react";
import type { Organization, WithContext } from "schema-dts";
import ModActions from "./modActions";

export default async function Layout({
  params,
  children,
}: {
  params: Record<string, any>;
  children: ReactNode;
}) {
  const client = await getServerClient();

  const entityId = Number(params.entityId);
  const entity = await client.entities.details({
    entity: entityId,
  });

  // tombstone path - redirect to the absolute url to ensure search engines dont get mad
  if (entity.id !== entityId) {
    // const newPath = pathname.replace(
    //   `/entities/${entityId}`,
    //   `/entities/${entity.id}`,
    // );
    // TODO: this should redirect to subpath
    return redirect(`/entities/${entity.id}/`);
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
                href={`/addBottle?returnTo=${encodeURIComponent(`/entities/${entityId}`)}&${
                  entity.type.includes("brand") ? `brand=${entity.id}&` : ""
                }${
                  entity.type.includes("distiller")
                    ? `distiller=${entity.id}&`
                    : ""
                }${
                  entity.type.includes("bottler") ? `bottler=${entity.id}&` : ""
                }`}
                color="primary"
              >
                Add a Bottle
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
