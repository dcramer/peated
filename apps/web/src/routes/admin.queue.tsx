import type { Outputs } from "@peated/server/orpc/router";
import { type Bottle } from "@peated/server/types";
import BottleSelector from "@peated/web/components/admin/bottleSelector";
import Button from "@peated/web/components/button";
import { useFlashMessages } from "@peated/web/components/flash";
import Link from "@peated/web/components/link";
import SimpleHeader from "@peated/web/components/simpleHeader";
import Table from "@peated/web/components/table";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute({
  component: Page,
});

function Page() {
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  const queryParams = useApiQueryParams({
    numericFields: ["cursor", "limit"],
    overrides: {
      onlyUnknown: true,
    },
  });

  const orpc = useORPC();
  const { data: aliasList } = useSuspenseQuery(
    orpc.bottles.unmatched.queryOptions({
      input: queryParams,
    }),
  );

  const [unmatchedBottle, setUnmatchedBottle] = useState<
    Outputs["bottles"]["unmatched"]["results"][number] | null
  >(null);

  // this isnt useful as the upsert wipes the cache but we dont totally want that
  const [assignments, setAssignments] = useState<Record<string, Bottle>>({});

  const bottleAliasUpdateMutation = useMutation(
    orpc.bottleAliases.update.mutationOptions(),
  );
  const bottleAliasUpsertMutation = useMutation(
    orpc.bottleAliases.upsert.mutationOptions(),
  );

  const { flash } = useFlashMessages();

  return (
    <>
      <SimpleHeader>Discovered Bottles</SimpleHeader>
      <Table
        items={aliasList.results}
        rel={aliasList.rel}
        primaryKey={(item) => String(item.name)}
        columns={[
          {
            name: "name",
            value: (item) => {
              return (
                <div>
                  <a
                    onClick={() => {
                      setUnmatchedBottle(item);
                    }}
                    className="cursor-pointer font-bold hover:underline"
                  >
                    {item.name}
                  </a>
                  {item.exampleListing && (
                    <div className="text-muted">
                      {" "}
                      <Link
                        href={item.exampleListing.url}
                        target="_blank"
                        className="underline"
                      >
                        {item.exampleListing.site.name}
                      </Link>
                    </div>
                  )}
                </div>
              );
            },
          },
          {
            name: "action",
            value: (item) => (
              <>
                <Button
                  onClick={async () => {
                    await bottleAliasUpdateMutation.mutateAsync({
                      alias: item.name,
                      ignored: true,
                    });
                    flash(
                      <div>
                        Marked{" "}
                        <strong className="font-bold">{item.name}</strong> as
                        hidden
                      </div>,
                    );
                  }}
                  className="hover:underline"
                >
                  Ignore
                </Button>
              </>
            ),
          },
        ]}
      />

      <BottleSelector
        open={!!unmatchedBottle}
        name={unmatchedBottle?.name}
        source={unmatchedBottle?.exampleListing?.url}
        returnTo={pathname}
        onClose={() => {
          setUnmatchedBottle(null);
        }}
        onSelect={async (bottle) => {
          if (!unmatchedBottle) return;
          const name = unmatchedBottle.name;
          await bottleAliasUpsertMutation.mutateAsync({
            bottle: bottle.id,
            name,
          });
          flash(
            <div>
              Assigned{" "}
              <strong className="font-bold">{unmatchedBottle.name}</strong> to{" "}
              <Link href={`/bottles/${bottle.id}`} className="underline">
                {bottle.fullName}
              </Link>
            </div>,
          );
          setAssignments((value) => ({
            ...value,
            [name]: bottle,
          }));
          setUnmatchedBottle(null);
        }}
      />
    </>
  );
}
