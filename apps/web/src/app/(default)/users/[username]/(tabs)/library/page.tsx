"use client";
import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import LibraryEntryActions, {
  LibraryEntryImage,
  LibraryEntryThumbnail,
} from "@peated/web/components/libraryEntryActions";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { use } from "react";
import { useProfileUserId } from "../../profileContext";

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
  const profileUserId = useProfileUserId();
  const queryParams = useApiQueryParams({
    overrides: {
      user: username,
      collection: "library",
    },
  });
  const { data: bottles } = useSuspenseQuery(
    orpc.collections.bottles.list.queryOptions({
      input: queryParams,
    }),
  );
  const canEditLibraryImages = user?.id === profileUserId;

  return bottles.results.length ? (
    <BottleTable
      bottleList={bottles.results}
      rel={bottles.rel}
      showBottleStats={false}
      renderCollectionBottleImage={(entry) =>
        canEditLibraryImages ? (
          <LibraryEntryImage entry={entry} username={username} />
        ) : (
          <LibraryEntryThumbnail entry={entry} />
        )
      }
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
