"use client";
import BottleTable from "@peated/web/components/bottleTable";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import LibraryEntryActions, {
  LibraryEntryImage,
  LibraryEntryStatus,
  LibraryEntryThumbnail,
} from "@peated/web/components/libraryEntryActions";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import useAuth from "@peated/web/hooks/useAuth";
import classNames from "@peated/web/lib/classNames";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { use, useTransition } from "react";
import { useProfileUserId } from "../../profileContext";
import { LibraryFilters } from "./libraryFilters";
import LibraryInsights from "./libraryInsights";

export default function UserLibrary(props: {
  params: Promise<{ username: string }>;
}) {
  const params = use(props.params);

  const { username } = params;

  return <UserLibraryTable username={username} />;
}

function UserLibraryTable({ username }: { username: string }) {
  const orpc = useORPC();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
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
  const canEditLibrary = user?.id === profileUserId;
  const libraryHref = `/users/${username}/library`;
  const hasActiveFilters = Boolean(
    queryParams.query ||
    queryParams.brand ||
    queryParams.distiller ||
    queryParams.status,
  );

  return (
    <>
      <LibraryInsights username={username} />
      <LibraryFilters
        loading={isPending}
        onNavigate={(href) => {
          startTransition(() => router.push(href));
        }}
      />
      <div
        className={classNames(
          "relative transition-opacity",
          isPending ? "opacity-60" : "",
        )}
        aria-busy={isPending ? "true" : undefined}
      >
        {isPending && (
          <div
            className="bg-highlight absolute inset-x-0 top-0 z-10 h-px animate-pulse"
            aria-hidden="true"
          />
        )}
        {bottles.results.length ? (
          <BottleTable
            bottleList={bottles.results}
            rel={bottles.rel}
            conciseBottlingNames
            hideLibraryStatus
            showBottleStats={false}
            renderCollectionBottleImage={(entry) =>
              canEditLibrary ? (
                <LibraryEntryImage entry={entry} username={username} />
              ) : (
                <LibraryEntryThumbnail entry={entry} />
              )
            }
            renderCollectionBottleMeta={(entry) =>
              canEditLibrary ? null : <LibraryEntryStatus entry={entry} />
            }
            renderCollectionBottleActions={
              canEditLibrary
                ? (entry) => (
                    <LibraryEntryActions entry={entry} username={username} />
                  )
                : undefined
            }
          />
        ) : hasActiveFilters ? (
          <EmptyActivity>
            <div className="flex flex-col items-center gap-3">
              <div>No library bottles match these filters.</div>
              <Button href={libraryHref}>Clear filters</Button>
            </div>
          </EmptyActivity>
        ) : (
          <EmptyActivity>No library bottles recorded yet.</EmptyActivity>
        )}
      </div>
    </>
  );
}
