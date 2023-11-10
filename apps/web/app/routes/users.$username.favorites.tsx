import type { User } from "@peated/server/types";
import { useOutletContext } from "@remix-run/react";
import BottleTable from "~/components/bottleTable";
import EmptyActivity from "~/components/emptyActivity";
import { trpc } from "~/lib/trpc";

export default function ProfileCollections() {
  const { user } = useOutletContext<{ user: User }>();
  const { data } = trpc.collectionBottleList.useQuery({
    user: user.id,
    collection: "default",
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
