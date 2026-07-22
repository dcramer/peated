"use client";

import BottleGroupField, {
  type BottleGroupOption,
} from "@peated/web/components/bottleGroupField";
import Fieldset from "@peated/web/components/fieldset";
import { useFlashMessages } from "@peated/web/components/flash";
import Form from "@peated/web/components/form";
import FormError from "@peated/web/components/formError";
import FormScreen from "@peated/web/components/formScreen";
import { ModRequired } from "@peated/web/hooks/useAuthRequired";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { use, useState, type FormEvent } from "react";

export default function Page({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = use(params);

  return (
    <ModRequired>
      <MergeBottleGroupForm groupId={Number(groupId)} />
    </ModRequired>
  );
}

function MergeBottleGroupForm({ groupId }: { groupId: number }) {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { flash } = useFlashMessages();
  const { data: sourceTarget } = useSuspenseQuery(
    orpc.bottleGroups.details.queryOptions({ input: { group: groupId } }),
  );
  const [destination, setDestination] = useState<BottleGroupOption | null>(
    null,
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const mergeMutation = useMutation(orpc.bottleGroups.merge.mutationOptions());

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!destination) {
      setValidationError("Select the destination expression for this merge.");
      return;
    }

    setValidationError(null);
    mergeMutation.mutate(
      {
        group: sourceTarget.group.id,
        destinationGroupId: destination.id,
      },
      {
        onSuccess: ({ destinationGroupId }) => {
          queryClient.invalidateQueries({
            queryKey: orpc.bottleGroups.details.key({
              input: { group: destinationGroupId },
            }),
          });
          flash(<div>Expression groups merged successfully.</div>);
          router.push(`/bottle-groups/${destinationGroupId}`);
        },
      },
    );
  };

  const error = validationError
    ? validationError
    : mergeMutation.isError
      ? getFormErrorMessage(mergeMutation.error)
      : null;

  return (
    <FormScreen
      title="Merge expression groups"
      saveLabel="Merge groups"
      saveDisabled={mergeMutation.isPending}
      onSave={onSubmit}
    >
      <Form onSubmit={onSubmit} isSubmitting={mergeMutation.isPending}>
        {error && <FormError values={[error]} />}
        <div className="border-y border-slate-800 p-4 lg:border-x lg:p-5">
          <h2 className="font-semibold">Source expression</h2>
          <p className="mt-1 break-words text-lg">
            {sourceTarget.group.fullName}
          </p>
          <p className="text-muted mt-1 text-sm">
            Group {sourceTarget.group.id} · {sourceTarget.group.totalBottles}{" "}
            {sourceTarget.group.totalBottles === 1 ? "release" : "releases"}
          </p>
        </div>
        <Fieldset>
          <BottleGroupField
            name="destinationGroupId"
            label="Destination expression"
            helpText="Choose the existing expression whose shared identity should win."
            required
            value={destination}
            onChange={(option) => {
              setDestination(option ?? null);
              setValidationError(null);
            }}
            onResults={(results: BottleGroupOption[]) =>
              results.filter(({ id }) => id !== sourceTarget.group.id)
            }
          />
        </Fieldset>
        <div className="border-x border-b border-slate-800 p-4 text-sm lg:p-5">
          <h2 className="font-semibold">Merge direction</h2>
          <p className="text-muted mt-2">
            {destination ? (
              <>
                Move every Bottle from “{sourceTarget.group.fullName}” into “
                {destination.fullName}”. The source group is retired, generic
                activity moves to the destination, and the destination&apos;s
                shared identity regenerates the moved Bottles.
              </>
            ) : (
              "Select a destination to review the exact merge direction."
            )}
          </p>
        </div>
      </Form>
    </FormScreen>
  );
}
