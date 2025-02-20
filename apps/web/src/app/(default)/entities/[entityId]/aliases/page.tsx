"use client";
import { use } from "react";

import Chip from "@peated/web/components/chip";
import ConfirmationButton from "@peated/web/components/confirmationButton";
import Table from "@peated/web/components/table";
import TimeSince from "@peated/web/components/timeSince";
import useAuth from "@peated/web/hooks/useAuth";
import { trpc } from "@peated/web/lib/trpc/client";

export default function EntityAliases(props: {
  params: Promise<{ entityId: string }>;
}) {
  const params = use(props.params);

  const { entityId } = params;

  const { user } = useAuth();
  const [aliasList] = trpc.entityAliasList.useSuspenseQuery({
    entity: Number(entityId),
  });
  const deleteAliasMutation = trpc.entityAliasDelete.useMutation();

  return (
    <Table
      items={aliasList.results}
      columns={[
        {
          name: "name",
          value: (item) => (
            <>
              <div>{item.name}</div>
              {item.isCanonical && (
                <Chip as="div" size="small" color="highlight">
                  Canonical
                </Chip>
              )}
            </>
          ),
        },
        {
          name: "created",
          value: (item) => <TimeSince date={item.createdAt} />,
        },
        {
          hidden: !user?.mod,
          name: "delete",
          title: "",
          value: (item) =>
            !item.isCanonical && (
              <ConfirmationButton
                onContinue={() => deleteAliasMutation.mutate(item.name)}
              >
                Delete
              </ConfirmationButton>
            ),
        },
      ]}
    />
  );
}
