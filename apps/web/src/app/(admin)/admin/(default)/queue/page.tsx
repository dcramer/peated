"use client";

import { type Bottle } from "@peated/server/types";
import Button from "@peated/web/components/button";
import { useFlashMessages } from "@peated/web/components/flash";
import Link from "@peated/web/components/link";
import SimpleHeader from "@peated/web/components/simpleHeader";
import Table from "@peated/web/components/table";
import { trpc, type RouterOutputs } from "@peated/web/lib/trpc/client";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import BottleSelector from "./bottleSelector";

export default function Page() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [aliasList] = trpc.bottleAliasList.useSuspenseQuery({
    ...Object.fromEntries(searchParams.entries()),
    onlyUnknown: true,
  });
  const [unmatchedBottle, setUnmatchedBottle] = useState<
    null | RouterOutputs["bottleAliasList"]["results"][number]
  >(null);

  // this isnt useful as the upsert wipes the cache but we dont totally want that
  const [assignments, setAssignments] = useState<Record<string, Bottle>>({});

  const bottleAliasUpdateMutation = trpc.bottleAliasUpdate.useMutation();
  const bottleAliasUpsertMutation = trpc.bottleAliasUpsert.useMutation();

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
              const match = assignments[item.name];
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
                  {match && (
                    <div className="text-muted">
                      Matched to{" "}
                      <Link href={`/bottle/${match.id}`} className="underline">
                        {match.fullName}
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
                      name: item.name,
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
                {bottle.name}
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
