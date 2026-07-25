"use client";

import type { ExactCatalogTargetV1 } from "@peated/server/schemas";
import Button from "@peated/web/components/button";
import { useFlashMessages } from "@peated/web/components/flash";
import Form from "@peated/web/components/form";
import FormError from "@peated/web/components/formError";
import FormScreen from "@peated/web/components/formScreen";
import { ModRequired } from "@peated/web/hooks/useAuthRequired";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  getReleaseFamilyHref,
  parseReleaseFamilyRouteId,
  requireReleaseFamilyGroup,
} from "@peated/web/lib/releaseFamily";
import {
  useMutation,
  useQueryClient,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { use, useState, type FormEvent } from "react";
import { z } from "zod";

const SplitBottleGroupFormSchema = z
  .object({
    movedBottleIds: z.array(z.number().int().positive()).nonempty(),
    newRepresentativeBottleId: z.number().int().positive(),
    sourceRepresentativeBottleId: z.number().int().positive().optional(),
  })
  .strict();

export default function Page({
  params,
}: {
  params: Promise<{ bottleId: string }>;
}) {
  const { bottleId } = use(params);

  return (
    <ModRequired>
      <SplitReleaseFamilyForm
        anchorBottleId={parseReleaseFamilyRouteId(bottleId)}
      />
    </ModRequired>
  );
}

function SplitReleaseFamilyForm({
  anchorBottleId,
}: {
  anchorBottleId: number;
}) {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { flash } = useFlashMessages();
  const { data: anchorBottle } = useSuspenseQuery(
    orpc.bottles.details.queryOptions({ input: { bottle: anchorBottleId } }),
  );
  const groupId = requireReleaseFamilyGroup(anchorBottle).id;
  const { data: sourceTarget } = useSuspenseQuery(
    orpc.bottleGroups.details.queryOptions({ input: { group: groupId } }),
  );
  const {
    data: memberPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSuspenseInfiniteQuery(
    orpc.bottleGroups.bottles.infiniteOptions({
      input: (cursor: number) => ({
        group: groupId,
        cursor,
        limit: 100,
        sort: "name",
      }),
      initialPageParam: 1,
      getNextPageParam: (lastPage) => lastPage.rel?.nextCursor,
      getPreviousPageParam: (firstPage) => firstPage.rel?.prevCursor,
    }),
  );
  const members = memberPages.pages.flatMap(({ results }) => results);
  const [movedBottleIds, setMovedBottleIds] = useState<number[]>([]);
  const [newRepresentativeBottleId, setNewRepresentativeBottleId] = useState<
    number | null
  >(null);
  const [sourceRepresentativeBottleId, setSourceRepresentativeBottleId] =
    useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const splitMutation = useMutation(orpc.bottleGroups.split.mutationOptions());

  const movedIds = new Set(movedBottleIds);
  const currentRepresentativeId = sourceTarget.group.representativeBottleId;
  const currentRepresentativeMoves =
    currentRepresentativeId !== null && movedIds.has(currentRepresentativeId);
  const survivingMembers = members.filter(
    ({ bottle }) => !movedIds.has(bottle.id),
  );

  const toggleBottle = (bottleId: number) => {
    const nextMovedIds = movedIds.has(bottleId)
      ? movedBottleIds.filter((id) => id !== bottleId)
      : [...movedBottleIds, bottleId];
    setMovedBottleIds(nextMovedIds);
    if (
      newRepresentativeBottleId !== null &&
      !nextMovedIds.includes(newRepresentativeBottleId)
    ) {
      setNewRepresentativeBottleId(null);
    }
    if (
      sourceRepresentativeBottleId !== null &&
      nextMovedIds.includes(sourceRepresentativeBottleId)
    ) {
      setSourceRepresentativeBottleId(null);
    }
    setValidationError(null);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (hasNextPage) {
      setValidationError("Load every member before choosing a split.");
      return;
    }
    if (currentRepresentativeId === null) {
      setValidationError(
        "This release family has no valid representative to split.",
      );
      return;
    }
    if (movedBottleIds.length === members.length) {
      setValidationError("Leave at least one Bottle in the source family.");
      return;
    }

    const parsed = SplitBottleGroupFormSchema.safeParse({
      movedBottleIds,
      newRepresentativeBottleId,
      sourceRepresentativeBottleId: currentRepresentativeMoves
        ? (sourceRepresentativeBottleId ?? undefined)
        : undefined,
    });
    if (!parsed.success) {
      setValidationError(
        currentRepresentativeMoves && sourceRepresentativeBottleId === null
          ? "Choose representatives for both resulting release families."
          : "Select at least one Bottle and its new representative.",
      );
      return;
    }
    setValidationError(null);
    splitMutation.mutate(
      {
        group: sourceTarget.group.id,
        ...parsed.data,
      },
      {
        onSuccess: ({ newRepresentativeBottleId }) => {
          queryClient.invalidateQueries({
            queryKey: orpc.bottleGroups.details.key({
              input: { group: sourceTarget.group.id },
            }),
          });
          flash(<div>Selected releases moved into a new family.</div>);
          router.push(getReleaseFamilyHref(newRepresentativeBottleId));
        },
      },
    );
  };

  const error = validationError
    ? validationError
    : splitMutation.isError
      ? getFormErrorMessage(splitMutation.error)
      : null;

  return (
    <FormScreen
      title="Split releases"
      saveLabel="Create new family"
      saveDisabled={splitMutation.isPending || hasNextPage}
      onSave={onSubmit}
    >
      <Form onSubmit={onSubmit} isSubmitting={splitMutation.isPending}>
        {error && <FormError values={[error]} />}
        <div className="border-y border-slate-800 p-4 lg:border-x lg:p-5">
          <h2 className="font-semibold">{sourceTarget.group.fullName}</h2>
          <p className="text-muted mt-2 text-sm">
            Select a nonempty subset of exact Bottles to move. Generic activity,
            stable aliases, and editorial content remain on this source family.
          </p>
        </div>

        <fieldset className="border-x border-b border-slate-800">
          <legend className="sr-only">Bottles to move</legend>
          {members.map((target) => (
            <BottleSplitChoice
              key={target.bottle.id}
              target={target}
              selected={movedIds.has(target.bottle.id)}
              currentRepresentative={
                target.bottle.id === currentRepresentativeId
              }
              newRepresentative={target.bottle.id === newRepresentativeBottleId}
              onToggle={() => toggleBottle(target.bottle.id)}
              onChooseRepresentative={() => {
                setNewRepresentativeBottleId(target.bottle.id);
                setValidationError(null);
              }}
            />
          ))}
          {hasNextPage && (
            <div className="border-t border-slate-800 p-4 text-center">
              <Button
                type="button"
                loading={isFetchingNextPage}
                disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
              >
                Load remaining members
              </Button>
            </div>
          )}
        </fieldset>

        {currentRepresentativeMoves ? (
          <fieldset className="border-x border-b border-slate-800 p-4 lg:p-5">
            <legend className="font-semibold">
              Source family representative
            </legend>
            <p className="text-muted mt-1 text-sm">
              The current representative is moving. Choose a Bottle that will
              remain as the source family representative.
            </p>
            <div className="mt-3 space-y-2">
              {survivingMembers.map(({ bottle }) => (
                <label
                  key={bottle.id}
                  className="flex cursor-pointer items-start gap-3 rounded border border-slate-800 p-3"
                >
                  <input
                    type="radio"
                    name="sourceRepresentativeBottleId"
                    value={bottle.id}
                    checked={sourceRepresentativeBottleId === bottle.id}
                    onChange={() => {
                      setSourceRepresentativeBottleId(bottle.id);
                      setValidationError(null);
                    }}
                    className="mt-1"
                  />
                  <span className="min-w-0 break-words">{bottle.fullName}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : currentRepresentativeId !== null ? (
          <div className="border-x border-b border-slate-800 p-4 text-sm lg:p-5">
            The current representative remains with the source family.
          </div>
        ) : null}
      </Form>
    </FormScreen>
  );
}

function BottleSplitChoice({
  target,
  selected,
  currentRepresentative,
  newRepresentative,
  onToggle,
  onChooseRepresentative,
}: {
  target: ExactCatalogTargetV1;
  selected: boolean;
  currentRepresentative: boolean;
  newRepresentative: boolean;
  onToggle: () => void;
  onChooseRepresentative: () => void;
}) {
  const { bottle } = target;
  const details = [
    bottle.edition,
    bottle.releaseYear ? `${bottle.releaseYear} release` : null,
    bottle.abv !== null ? `${bottle.abv.toFixed(1)}% ABV` : null,
  ].filter((value): value is string => value !== null);

  return (
    <div className="border-b border-slate-800 p-4 last:border-b-0 lg:p-5">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-1"
        />
        <span className="min-w-0 flex-1">
          <span className="block break-words font-semibold">
            {bottle.fullName}
          </span>
          <span className="text-muted mt-1 block text-sm">
            Bottle {bottle.id}
            {details.length ? ` · ${details.join(" · ")}` : ""}
            {currentRepresentative ? " · Current representative" : ""}
          </span>
        </span>
      </label>
      {selected && (
        <label className="ml-7 mt-3 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="newRepresentativeBottleId"
            value={bottle.id}
            checked={newRepresentative}
            onChange={onChooseRepresentative}
          />
          Representative for the new family
        </label>
      )}
    </div>
  );
}
