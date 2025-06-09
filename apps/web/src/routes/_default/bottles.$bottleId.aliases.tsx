import Chip from "@peated/web/components/chip";
import ConfirmationButton from "@peated/web/components/confirmationButton";
import Table from "@peated/web/components/table";
import TimeSince from "@peated/web/components/timeSince";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_default/bottles/$bottleId/aliases")({
  component: Page,
});

function Page() {
  const { bottleId } = Route.useParams();
  const { user } = useAuth();
  const orpc = useORPC();
  const { data: aliasList } = useSuspenseQuery(
    orpc.bottleAliases.list.queryOptions({
      input: { bottle: Number(bottleId) },
    })
  );
  const deleteAliasMutation = useMutation(
    orpc.bottleAliases.delete.mutationOptions()
  );

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
                <Chip size="small" color="highlight">
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
                  deleteAliasMutation.mutate({ alias: item.name })
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
