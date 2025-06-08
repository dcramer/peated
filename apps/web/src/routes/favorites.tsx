import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import PaginationButtons from "@peated/web/components/paginationButtons";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DefaultLayout } from "../layouts";

export const Route = createFileRoute("/favorites")({
  component: Page,
});

function Page() {
  const orpc = useORPC();
  const { data: favoriteList } = useSuspenseQuery(
    orpc.collections.bottles.list.queryOptions({
      input: {
        user: "me",
        collection: "default",
      },
    })
  );

  return (
    <DefaultLayout>
      {favoriteList.results.length ? (
        <BottleTable bottleList={favoriteList.results} />
      ) : (
        <EmptyActivity>No favorites recorded yet.</EmptyActivity>
      )}
      <PaginationButtons rel={favoriteList.rel} />
    </DefaultLayout>
  );
}
