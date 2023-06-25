import type { Paginated } from "@peated/shared/types";
import { useOutletContext } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";
import BottleTable from "~/components/bottleTable";
import EmptyActivity from "~/components/emptyActivity";
import useApi from "~/hooks/useApi";
import type { Bottle, User } from "~/types";

export default function ProfileCollections() {
  const api = useApi();
  const { user } = useOutletContext<{ user: User }>();

  const { data } = useQuery({
    queryKey: ["collections", "user", user.id],
    queryFn: (): Promise<Paginated<Bottle>> =>
      api.get(`/users/${user.id}/collections/default/bottles`),
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
