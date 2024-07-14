"use client";

import { type Bottle } from "@peated/server/types";
import { useFlashMessages } from "@peated/web/components/flash";
import Link from "@peated/web/components/link";
import SimpleHeader from "@peated/web/components/simpleHeader";
import Table from "@peated/web/components/table";
import TimeSince from "@peated/web/components/timeSince";
import { trpc, type RouterOutputs } from "@peated/web/lib/trpc";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import BottleSelector from "./bottleSelector";

export default function Page() {
  const searchParams = useSearchParams();
  const [priceList] = trpc.priceList.useSuspenseQuery({
    ...Object.fromEntries(searchParams.entries()),
    onlyUnknown: true,
  });
  const [unmatchedBottle, setUnmatchedBottle] = useState<
    null | RouterOutputs["priceList"]["results"][number]
  >(null);

  // this isnt useful as the upsert wipes the cache but we dont totally want that
  const [assignments, setAssignments] = useState<Record<string, Bottle>>({});

  // lets create bottle alias
  const bottleAliasUpsertMutation = trpc.bottleAliasUpsert.useMutation();

  const { flash } = useFlashMessages();

  return (
    <>
      <SimpleHeader>Discovered Bottles</SimpleHeader>
      <Table
        items={priceList.results}
        rel={priceList.rel}
        primaryKey={(item) => String(item.id)}
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
                    className="cursor-pointer hover:underline"
                  >
                    {item.name}
                  </a>
                  <div>
                    [
                    <Link href={item.url} className="hover:underline">
                      View Listing
                    </Link>
                    ]
                  </div>
                  {match && (
                    <div className="text-light">
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
            name: "updated",
            value: (item) => <TimeSince date={item.updatedAt} />,
          },
        ]}
      />

      <BottleSelector
        open={!!unmatchedBottle}
        name={unmatchedBottle?.name}
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
