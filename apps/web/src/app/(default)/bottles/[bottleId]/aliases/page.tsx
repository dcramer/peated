"use client";

import Chip from "@peated/web/components/chip";
import ConfirmationButton from "@peated/web/components/confirmationButton";
import Table from "@peated/web/components/table";
import useAuth from "@peated/web/hooks/useAuth";
import { trpc } from "@peated/web/lib/trpc";

export default function BottleAliases({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const { user } = useAuth();
  const [aliasList] = trpc.bottleAliasList.useSuspenseQuery({
    bottle: Number(bottleId),
  });
  const deleteAliasMutation = trpc.bottleAliasDelete.useMutation();

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
          hidden: !user?.mod,
          name: "delete",
          title: "",
          value: (item) =>
            !item.isCanonical && (
              <ConfirmationButton
                onContinue={() =>
                  deleteAliasMutation.mutate({
                    bottle: Number(bottleId),
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
