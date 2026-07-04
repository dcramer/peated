"use client";
import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import LibraryEntryActions from "@peated/web/components/libraryEntryActions";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { use } from "react";

export default function UserLibrary(props: {
  params: Promise<{ username: string }>;
}) {
  const params = use(props.params);

  const { username } = params;

  return <UserLibraryTable username={username} />;
}

function UserLibraryTable({ username }: { username: string }) {
  const orpc = useORPC();
  const { user } = useAuth();
  const { data: bottles } = useSuspenseQuery(
    orpc.collections.bottles.list.queryOptions({
      input: {
        user: username,
        collection: "library",
      },
    }),
  );
  const canEditLibraryImages = user?.username === username;

  return bottles.results.length ? (
    <BottleTable
      bottleList={bottles.results}
      rel={bottles.rel}
      renderCollectionBottleActions={
        canEditLibraryImages
          ? (entry) => <LibraryEntryActions entry={entry} username={username} />
          : undefined
      }
    />
  ) : (
    <EmptyActivity>No library bottles recorded yet.</EmptyActivity>
  );
}
