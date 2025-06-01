import ActivityFeed from "@peated/web/components/activityFeed";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute({
  component: Page,
});

function Page() {
  useAuthRequired();

  const filter = "friends";
  const orpc = useORPC();
  const { data: tastingList } = useSuspenseQuery(
    orpc.tastings.list.queryOptions({
      input: {
        filter,
        limit: 10,
      },
    }),
  );

  return <ActivityFeed tastingList={tastingList} filter={filter} />;
}
