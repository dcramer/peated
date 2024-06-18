import type { User } from "@peated/server/types";
import EmptyActivity from "@peated/web/components/emptyActivity";
import QueryBoundary from "@peated/web/components/queryBoundary";
import TastingList from "@peated/web/components/tastingList";
import { trpc } from "@peated/web/lib/trpc";
import { useOutletContext } from "@remix-run/react";

export default function ProfileActivity() {
  const { user } = useOutletContext<{ user: User }>();
  const { data } = trpc.tastingList.useQuery({
    user: user.id,
  });

  return (
    <QueryBoundary>
      {data && data.results.length ? (
        <TastingList values={data.results} />
      ) : (
        <EmptyActivity>
          Looks like this ones a bit short on tastings.
        </EmptyActivity>
      )}
    </QueryBoundary>
  );
}
