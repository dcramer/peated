"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { AliasManager } from "@peated/web/components";
import TimeSince from "@peated/web/components/timeSince";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";

import { BottleSection } from "../bottleSection.stylex";

type AliasList = Outputs["bottleAliases"]["list"];

export function AliasList({
  bottleId,
  initialAliasList,
}: {
  bottleId: number;
  initialAliasList: AliasList;
}) {
  const { user } = useAuth();
  const orpc = useORPC();
  const [aliases, setAliases] = useState(initialAliasList.results);
  const createAlias = useMutation(orpc.bottleAliases.create.mutationOptions());
  const deleteAlias = useMutation(orpc.bottleAliases.delete.mutationOptions());

  return (
    <BottleSection heading="Also known as">
      <AliasManager
        aliases={aliases.map((alias) => ({
          created: <TimeSince date={alias.createdAt} />,
          name: alias.name,
        }))}
        canEdit={user?.mod}
        onCreate={async (name) => {
          const alias = await createAlias.mutateAsync({
            bottle: bottleId,
            name,
          });
          setAliases((values) =>
            [...values, alias].sort((left, right) =>
              left.name.localeCompare(right.name),
            ),
          );
        }}
        onDelete={async (name) => {
          const alias = aliases.find((value) => value.name === name);
          if (!alias) return;
          await deleteAlias.mutateAsync({ bottle: bottleId, alias: alias.id });
          setAliases((values) => values.filter((value) => value.name !== name));
        }}
      />
    </BottleSection>
  );
}
