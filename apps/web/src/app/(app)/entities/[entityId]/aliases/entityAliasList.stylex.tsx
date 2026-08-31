"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { AliasManager } from "@peated/web/components";
import { PageSection } from "@peated/web/components/pages/pageLayout.stylex";
import TimeSince from "@peated/web/components/timeSince";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";

type AliasList = Outputs["entities"]["aliases"]["list"];

export function EntityAliasList({
  entityId,
  initialAliasList,
}: {
  entityId: number;
  initialAliasList: AliasList;
}) {
  const { user } = useAuth();
  const orpc = useORPC();
  const [aliases, setAliases] = useState(initialAliasList.results);
  const createAlias = useMutation(
    orpc.entities.aliases.create.mutationOptions(),
  );
  const deleteAlias = useMutation(
    orpc.entities.aliases.delete.mutationOptions(),
  );

  return (
    <PageSection count={aliases.length} heading="Aliases">
      <AliasManager
        aliases={aliases.map((alias) => ({
          created: <TimeSince date={alias.createdAt} />,
          isPrimary: alias.isCanonical,
          name: alias.name,
        }))}
        canEdit={user?.mod}
        onCreate={async (name) => {
          const alias = await createAlias.mutateAsync({
            entity: entityId,
            name,
          });
          setAliases((values) => {
            const remaining = values.filter(
              (value) => value.name.toLowerCase() !== alias.name.toLowerCase(),
            );
            return [...remaining, alias];
          });
        }}
        onDelete={async (name) => {
          await deleteAlias.mutateAsync({ name });
          setAliases((values) => values.filter((value) => value.name !== name));
        }}
      />
    </PageSection>
  );
}
