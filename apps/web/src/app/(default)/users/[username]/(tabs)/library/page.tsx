"use client";

import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function UserLibrary({
  params: { username },
}: {
  params: { username: string };
}) {
  return <UserLibraryTable username={username} />;
}

function UserLibraryTable({ username }: { username: string }) {
  const orpc = useORPC();
  const { data: bottles } = useSuspenseQuery(
    orpc.collections.bottles.list.queryOptions({
      input: {
        user: username,
        collection: "library",
      },
    }),
  );

  return bottles.results.length ? (
    <BottleTable bottleList={bottles.results} rel={bottles.rel} />
  ) : (
    <EmptyActivity>No library bottles recorded yet.</EmptyActivity>
  );
}
