import ActivityFeed from "@peated/web/components/activityFeed";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/activity/local")({
  component: Page,
});

function Page() {
  const filter = "local";
  const orpc = useORPC();
  const { data: tastingList } = useSuspenseQuery(
    orpc.tastings.list.queryOptions({
      filter,
      limit: 10,
    })
  );

  return <ActivityFeed tastingList={tastingList} filter={filter} />;
}
