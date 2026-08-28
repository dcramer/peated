"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { AliasManager } from "@peated/web/components/designSystem/components";
import TimeSince from "@peated/web/components/timeSince";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";

import { BottleSection } from "../bottleSection.stylex";

type AliasList = Outputs["bottleAliases"]["list"];

export function AliasList({
  initialAliasList,
}: {
  initialAliasList: AliasList;
}) {
  const { user } = useAuth();
  const orpc = useORPC();
  const [aliases, setAliases] = useState(initialAliasList.results);
  const deleteAlias = useMutation(orpc.bottleAliases.delete.mutationOptions());

  return (
    <BottleSection count={aliases.length} heading="Aliases">
      <AliasManager
        aliases={aliases.map((alias) => ({
          created: <TimeSince date={alias.createdAt} />,
          isCanonical: Boolean(alias.isCanonical),
          name: alias.name,
        }))}
        canEdit={user?.mod}
        onDelete={async (name) => {
          await deleteAlias.mutateAsync({ alias: name });
          setAliases((values) => values.filter((value) => value.name !== name));
        }}
      />
    </BottleSection>
  );
}
