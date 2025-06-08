import ActivityFeed from "@peated/web/components/activityFeed";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DefaultLayout } from "../layouts";

export const Route = createFileRoute("/")({
  component: Page,
});

function Page() {
  const filter = "global";
  const orpc = useORPC();
  const { data: tastingList } = useSuspenseQuery(
    orpc.tastings.list.queryOptions({
      filter,
      limit: 10,
    })
  );

  return (
    <DefaultLayout>
      <ActivityFeed tastingList={tastingList} filter={filter} />
    </DefaultLayout>
  );
}
