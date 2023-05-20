import { useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import BottleTable from "../components/bottleTable";
import EmptyActivity from "../components/emptyActivity";
import api from "../lib/api";
import { Bottle, Paginated, User } from "../types";

export default function ProfileCollections() {
  const { user } = useOutletContext<{ user: User }>();

  const { data } = useQuery({
    queryKey: ["collections", "user", user.id],
    queryFn: (): Promise<Paginated<Bottle>> =>
      api.get("/bottles", {
        query: {
          user: user.id,
          collection: "default",
        },
      }),
  });

  return (
    <>
      {data && data.results.length ? (
        <BottleTable bottleList={data.results} rel={data.rel} />
      ) : (
        <EmptyActivity>No collections started yet.</EmptyActivity>
      )}
    </>
  );
}
