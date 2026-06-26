"use client";

import Button from "@peated/web/components/button";
import Chip from "@peated/web/components/chip";
import ConfirmationButton from "@peated/web/components/confirmationButton";
import Table from "@peated/web/components/table";
import TextField from "@peated/web/components/textField";
import TimeSince from "@peated/web/components/timeSince";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

export default function EntityAliases({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const { user } = useAuth();
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const aliasesQueryOptions = orpc.entities.aliases.list.queryOptions({
    input: { entity: Number(entityId) },
  });
  const { data: aliasList } = useSuspenseQuery(aliasesQueryOptions);
  const [aliasName, setAliasName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createAliasMutation = useMutation(
    orpc.entities.aliases.create.mutationOptions(),
  );

  const deleteAliasMutation = useMutation(
    orpc.entities.aliases.delete.mutationOptions(),
  );

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      await createAliasMutation.mutateAsync({
        entity: Number(entityId),
        name: aliasName,
      });
      setAliasName("");
      await queryClient.invalidateQueries({
        queryKey: aliasesQueryOptions.queryKey,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add alias.");
    }
  };

  return (
    <>
      {user?.mod && (
        <form
          className="mb-6 flex flex-col gap-3 border border-slate-800 sm:flex-row sm:items-start"
          onSubmit={onSubmit}
        >
          <TextField
            name="alias"
            label="Alias"
            value={aliasName}
            onChange={(event) =>
              setAliasName((event.target as HTMLInputElement).value)
            }
            error={error ? { message: error } : undefined}
            className="flex-1"
          />
          <Button
            type="submit"
            color="primary"
            disabled={!aliasName.trim() || createAliasMutation.isPending}
            loading={createAliasMutation.isPending}
            className="m-4 sm:mt-9"
          >
            Add Alias
          </Button>
        </form>
      )}
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
                  onContinue={async () => {
                    await deleteAliasMutation.mutateAsync({
                      name: item.name,
                    });
                    await queryClient.invalidateQueries({
                      queryKey: aliasesQueryOptions.queryKey,
                    });
                  }}
                >
                  Delete
                </ConfirmationButton>
              ),
          },
        ]}
      />
    </>
  );
}
