import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute({
  component: Page,
});

function Page() {
  const { username } = Route.useParams();
  const orpc = useORPC();
  const { data: bottles } = useSuspenseQuery(
    orpc.bottles.list.queryOptions({
      input: {
        user: username,
        collection: "favorites",
      },
    }),
  );

  return bottles.results.length ? (
    <BottleTable bottleList={bottles.results} rel={bottles.rel} />
  ) : (
    <EmptyActivity>No favorites recorded yet.</EmptyActivity>
  );
}
