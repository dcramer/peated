import type { User } from "@peated/server/types";
import { useOutletContext } from "@remix-run/react";
import EmptyActivity from "~/components/emptyActivity";
import QueryBoundary from "~/components/queryBoundary";
import TastingList from "~/components/tastingList";
import { trpc } from "~/lib/trpc";

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
