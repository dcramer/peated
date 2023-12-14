import type { User } from "@peated/server/types";
import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { trpc } from "@peated/web/lib/trpc";
import { useOutletContext } from "@remix-run/react";

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
