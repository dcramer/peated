import BetaNotice from "@peated/web/components/betaNotice";
import BottleTable from "@peated/web/components/bottleTable";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/bottles/$bottleId/similar")({
  component: Page,
});

function Page() {
  const { bottleId } = Route.useParams();
  const orpc = useORPC();
  const { data: bottleList } = useSuspenseQuery(
    orpc.bottles.similar.queryOptions({
      input: {
        bottle: Number(bottleId),
      },
    }),
  );

  return (
    <div className="mt-6 px-3 lg:px-0">
      <BetaNotice>This is a work in progress.</BetaNotice>

      <BottleTable bottleList={bottleList.results} rel={bottleList.rel} />
    </div>
  );
}
