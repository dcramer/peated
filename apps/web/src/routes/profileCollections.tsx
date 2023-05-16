import { useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import EmptyActivity from "../components/emptyActivity";
import QueryBoundary from "../components/queryBoundary";
import api from "../lib/api";
import { Paginated, Tasting, User } from "../types";

export default function ProfileCollections() {
  const { user } = useOutletContext<{ user: User }>();

  const { data } = useQuery({
    queryKey: ["collections", "user", user.id],
    queryFn: (): Promise<Paginated<Tasting>> =>
      api.get("/collections", {
        query: {
          user: user.id,
        },
      }),
  });

  return (
    <QueryBoundary>
      {data && data.results.length ? (
        <p>Show collections here</p>
      ) : (
        <EmptyActivity>No collections started yet.</EmptyActivity>
      )}
    </QueryBoundary>
  );
}
