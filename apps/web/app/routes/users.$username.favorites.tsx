import type { User } from "@peated/shared/types";
import { useOutletContext } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";
import BottleTable from "~/components/bottleTable";
import EmptyActivity from "~/components/emptyActivity";
import useApi from "~/hooks/useApi";
import { fetchBottlesInCollection } from "~/queries/collections";

export default function ProfileCollections() {
  const api = useApi();
  const { user } = useOutletContext<{ user: User }>();

  const { data } = useQuery({
    queryKey: ["collections", "user", user.id],
    queryFn: () => fetchBottlesInCollection(api, user.id, "default"),
  });

  return (
    <>
      {data && data.results.length ? (
        <BottleTable bottleList={data.results} rel={data.rel} />
      ) : (
        <EmptyActivity>No favorites recorded yet.</EmptyActivity>
      )}
    </>
  );
}
