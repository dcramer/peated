import Button from "@peated/web/components/button";
import EntityHeader from "@peated/web/components/entityHeader";
import ShareButton from "@peated/web/components/shareButton";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
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
              <Button color="primary" asChild>
                <Link
                  to="/addBottle"
                  search={{
                    returnTo: `/entities/${entityId}`,
                    brand: entity.type.includes("brand")
                      ? entity.id
                      : undefined,
                    distiller: entity.type.includes("distiller")
                      ? entity.id
                      : undefined,
                    bottler: entity.type.includes("bottler")
                      ? entity.id
                      : undefined,
                  }}
                >
                  Add a Bottle
                </Link>
              </Button>

              <ShareButton title={entity.name} url={`/entities/${entity.id}`} />
            </div>
          </div>
        </div>
      </div>

      <Tabs border>
        <TabItem asChild controlled>
          <Link to="/entities/$entityId" params={{ entityId: entity.id }}>
            Overview
          </Link>
        </TabItem>
        <TabItem asChild controlled>
          <Link
            to="/entities/$entityId/bottles"
            params={{ entityId: entity.id }}
          >
            Bottles ({entity.totalBottles.toLocaleString()})
          </Link>
        </TabItem>
        <TabItem asChild controlled>
          <Link
            to="/entities/$entityId/tastings"
            params={{ entityId: entity.id }}
          >
            Tastings ({entity.totalTastings.toLocaleString()})
          </Link>
        </TabItem>
        {entity.shortName === "SMWS" && (
          <TabItem asChild controlled desktopOnly>
            <Link
              to="/entities/$entityId/codes"
              params={{ entityId: entity.id }}
            >
              Distillery Codes
            </Link>
          </TabItem>
        )}
      </Tabs>

      <Outlet />
    </DefaultLayout>
  );
}
