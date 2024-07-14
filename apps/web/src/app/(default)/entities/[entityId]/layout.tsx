import Button from "@peated/web/components/button";
import EntityHeader from "@peated/web/components/entityHeader";
import ShareButton from "@peated/web/components/shareButton";
import { getTrpcClient } from "@peated/web/lib/trpc.server";
import { redirect } from "next/navigation";
import { type ReactNode } from "react";
import ModActions from "./modActions";

export default async function Layout({
  params,
  children,
}: {
  params: Record<string, any>;
  children: ReactNode;
}) {
  const entityId = Number(params.entityId);
  const trpcClient = await getTrpcClient();
  const entity = await trpcClient.entityById.fetch(entityId);

  // tombstone path - redirect to the absolute url to ensure search engines dont get mad
  if (entity.id !== entityId) {
    // const newPath = pathname.replace(
    //   `/entities/${entityId}`,
    //   `/entities/${entity.id}`,
    // );
    // TODO: this should redirect to subpath
    return redirect(`/entities/${entity.id}/`);
  }

  return (
    <>
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
