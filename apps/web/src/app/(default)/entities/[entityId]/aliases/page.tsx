"use client";

import Chip from "@peated/web/components/chip";
import ConfirmationButton from "@peated/web/components/confirmationButton";
import Table from "@peated/web/components/table";
import TimeSince from "@peated/web/components/timeSince";
import useAuth from "@peated/web/hooks/useAuth";
import { trpc } from "@peated/web/lib/trpc";

export default function EntityAliases({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
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
                onContinue={() =>
                  deleteAliasMutation.mutate({
                    entity: Number(entityId),
                    name: item.name,
                  })
                }
              >
                Delete
              </ConfirmationButton>
            ),
        },
      ]}
    />
  );
}
