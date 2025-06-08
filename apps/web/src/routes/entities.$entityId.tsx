import Button from "@peated/web/components/button";
import EntityHeader from "@peated/web/components/entityHeader";
import ShareButton from "@peated/web/components/shareButton";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { DefaultLayout } from "../layouts";

export const Route = createFileRoute("/entities/$entityId")({
  component: EntityLayoutPage,
});

function EntityLayoutPage() {
  const { entityId } = Route.useParams();
  const orpc = useORPC();
  const { data: entity } = useSuspenseQuery(
    orpc.entities.details.queryOptions({
      input: {
        entity: Number(entityId),
      },
    })
  );

  return (
    <DefaultLayout>
      <div className="w-full p-3 lg:py-0">
        <EntityHeader entity={entity} />

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex-auto">
            <div className="my-8 flex justify-center gap-4 lg:justify-start">
              <Button
                to={`/addBottle?returnTo=${encodeURIComponent(`/entities/${entityId}`)}&${
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
            </div>
          </div>
        </div>
      </div>

      <Outlet />
    </DefaultLayout>
  );
}
