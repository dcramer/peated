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
    <PageSection heading="Also known as">
      <AliasManager
        aliases={aliases.map((alias) => ({
          badge: alias.isShortName ? "Short name" : undefined,
          canDelete: !alias.isShortName,
          created: alias.createdAt ? (
            <TimeSince date={alias.createdAt} />
          ) : null,
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
          const alias = aliases.find((value) => value.name === name);
          if (!alias?.id) return;
          await deleteAlias.mutateAsync({ entity: entityId, alias: alias.id });
          setAliases((values) => values.filter((value) => value.name !== name));
        }}
      />
    </PageSection>
  );
}
