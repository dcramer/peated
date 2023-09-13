import type { User } from "@peated/shared/types";
import { useOutletContext } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";
import EmptyActivity from "~/components/emptyActivity";
import QueryBoundary from "~/components/queryBoundary";
import TastingList from "~/components/tastingList";
import useApi from "~/hooks/useApi";
import { fetchTastings } from "~/queries/tastings";

export default function ProfileActivity() {
  const api = useApi();
  const { user } = useOutletContext<{ user: User }>();

  const { data } = useQuery({
    queryKey: ["tastings", "user", user.id],
    queryFn: () =>
      fetchTastings(api, {
        user: user.id,
      }),
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
