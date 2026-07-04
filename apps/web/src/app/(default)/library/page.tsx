"use client";

import BottleTable from "@peated/web/components/bottleTable";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import LibraryEntryActions, {
  LibraryEntryImage,
} from "@peated/web/components/libraryEntryActions";
import { getAddBottleHref } from "@peated/web/lib/addBottle";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";

export const fetchCache = "default-no-store";

export default function Page() {
  const orpc = useORPC();
  const { data: bottleList } = useSuspenseQuery(
    orpc.collections.bottles.list.queryOptions({
      input: {
        user: "me",
        collection: "library",
      },
    }),
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          href={getAddBottleHref({ intent: "library" })}
          color="highlight"
          icon={<PlusIcon className="h-4 w-4" />}
        >
          Add Bottle
        </Button>
      </div>
      {bottleList.results.length ? (
        <BottleTable
          bottleList={bottleList.results}
          rel={bottleList.rel}
          showBottleStats={false}
          renderCollectionBottleImage={(entry) => (
            <LibraryEntryImage entry={entry} username="me" />
          )}
          renderCollectionBottleActions={(entry) => (
            <LibraryEntryActions entry={entry} username="me" />
          )}
        />
      ) : (
        <EmptyActivity>No library bottles recorded yet.</EmptyActivity>
      )}
    </div>
  );
}
