import EmptyActivity from "@peated/web/components/emptyActivity";
import TastingList from "@peated/web/components/tastingList";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/users/$username")({
  component: Page,
});

function Page() {
  const { username } = Route.useParams();
  const orpc = useORPC();
  const { data: tastings } = useSuspenseQuery(
    orpc.tastings.list.queryOptions({
      input: { user: username, limit: 10 },
    })
  );

  if (!tastings.results.length) {
    return <EmptyActivity />;
  }

  return <TastingList values={tastings.results} />;
}
