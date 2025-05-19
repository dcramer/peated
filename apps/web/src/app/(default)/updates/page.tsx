"use client";

import ChangeList from "@peated/web/components/changeList";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page() {
  const orpc = useORPC();
  const { data: changeList } = useSuspenseQuery(
    orpc.changes.list.queryOptions({
      input: {},
    }),
  );

  return (
    <>
      {changeList.results.length > 0 ? (
        <ChangeList values={changeList.results} rel={changeList.rel} />
      ) : (
        <EmptyActivity>
          Looks like theres no updates in the system. That's odd.
        </EmptyActivity>
      )}
    </>
  );
}
