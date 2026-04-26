"use client";

import AdminWorkstreamTabs from "@peated/web/components/admin/workstreamTabs";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { useFlashMessages } from "@peated/web/components/flash";
import Form from "@peated/web/components/form";
import Link from "@peated/web/components/link";
import PaginationButtons from "@peated/web/components/paginationButtons";
import SimpleHeader from "@peated/web/components/simpleHeader";
import TextInput from "@peated/web/components/textInput";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { buildQueryString } from "@peated/web/lib/urls";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

function formatTastingCount(value: null | number): string {
  return (value ?? 0).toLocaleString();
}

function buildBrandRepairHref(
  pathname: string,
  searchParams: URLSearchParams,
  nextParams: Record<string, null | number | string | undefined>,
): string {
  const queryString = buildQueryString(searchParams, nextParams);
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export default function Page() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get("query") ?? "";
  const queryParams = useApiQueryParams({
    defaults: {
      limit: 25,
    },
    numericFields: ["cursor", "limit"],
  });

  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { flash } = useFlashMessages();
  const [repairingBottleId, setRepairingBottleId] = useState<number | null>(
    null,
  );
  const [repairingGroupKey, setRepairingGroupKey] = useState<string | null>(
    null,
  );
  const groupListQueryOptions = orpc.bottles.brandRepairGroups.queryOptions({
    input: {
      query: currentQuery,
      cursor: 1,
      limit: 10,
    },
  });
  const { data: groupList } = useSuspenseQuery(groupListQueryOptions);
  const candidateListQueryOptions =
    orpc.bottles.brandRepairCandidates.queryOptions({
      input: queryParams,
    });
  const { data: candidateList } = useSuspenseQuery(candidateListQueryOptions);
  const applyRepairMutation = useMutation(
    orpc.bottles.applyBrandRepair.mutationOptions(),
  );
  const applyGroupRepairMutation = useMutation(
    orpc.bottles.applyBrandRepairGroup.mutationOptions(),
  );

  const applyRepair = async ({
    bottleId,
    bottleName,
    currentBrandId,
    currentBrandName,
    targetBrandId,
    targetBrandName,
    distilleryId,
    distilleryName,
  }: {
    bottleId: number;
    bottleName: string;
    currentBrandId: number;
    currentBrandName: string;
    targetBrandId: number;
    targetBrandName: string;
    distilleryId: number | null;
    distilleryName: string | null;
  }) => {
    setRepairingBottleId(bottleId);
    try {
      await applyRepairMutation.mutateAsync({
        bottle: bottleId,
        fromBrand: currentBrandId,
        toBrand: targetBrandId,
        distillery: distilleryId,
      });
      await queryClient.invalidateQueries({
        queryKey: candidateListQueryOptions.queryKey,
      });
      flash(
        distilleryName
          ? `Moved ${bottleName} from ${currentBrandName} to ${targetBrandName} and kept ${distilleryName} as a distillery link.`
          : `Moved ${bottleName} from ${currentBrandName} to ${targetBrandName}.`,
      );
    } catch (err) {
      flash(
        err instanceof Error ? err.message : "Unable to apply brand repair.",
        "error",
      );
    } finally {
      setRepairingBottleId(null);
    }
  };

  const applyGroupRepair = async ({
    currentBrandId,
    currentBrandName,
    distilleryId,
    distilleryName,
    targetBrandId,
    targetBrandName,
  }: {
    currentBrandId: number;
    currentBrandName: string;
    distilleryId: number | null;
    distilleryName: string | null;
    targetBrandId: number;
    targetBrandName: string;
  }) => {
    const groupKey = `${currentBrandId}:${targetBrandId}:${distilleryId ?? "none"}`;
    setRepairingGroupKey(groupKey);
    try {
      const result = await applyGroupRepairMutation.mutateAsync({
        fromBrand: currentBrandId,
        toBrand: targetBrandId,
        distillery: distilleryId,
        query: currentQuery,
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: groupListQueryOptions.queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: candidateListQueryOptions.queryKey,
        }),
      ]);
      flash(
        distilleryName
          ? `Moved ${result.appliedCount} bottles from ${currentBrandName} to ${targetBrandName} and kept ${distilleryName} as a distillery link.`
          : `Moved ${result.appliedCount} bottles from ${currentBrandName} to ${targetBrandName}.`,
      );
    } catch (err) {
      flash(
        err instanceof Error ? err.message : "Unable to apply grouped repair.",
        "error",
      );
    } finally {
      setRepairingGroupKey(null);
    }
  };

  return (
    <>
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            href: "/admin",
          },
          {
            name: "Brand / Entity Repairs",
            href: "/admin/brand-repairs",
            current: true,
          },
        ]}
      />

      <SimpleHeader>Brand / Entity Repairs</SimpleHeader>

      <div className="mb-6 space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-4 text-sm text-slate-300">
          Use this queue when the bottle itself is correct but its stored brand
          entity is wrong, truncated, or attached to the wrong producer. Apply
          the repair here to move the bottle onto the correct brand entity
          without renaming its bottle title. If the source producer is really a
          distillery, the repair can preserve that link as well.
        </div>

        <AdminWorkstreamTabs />

        <Form
          action={pathname}
          className="mb-0 rounded-xl border border-slate-800 bg-slate-950 px-4 py-4"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <TextInput
                type="text"
                name="query"
                defaultValue={currentQuery}
                placeholder="Search bottle, alias, or brand names"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" color="primary">
                Search
              </Button>
              {currentQuery ? (
                <Button
                  href={buildBrandRepairHref(pathname, searchParams, {
                    query: null,
                    cursor: null,
                  })}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
        </Form>
      </div>

      {groupList.results.length > 0 ? (
        <div className="mb-8 space-y-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Clustered Repairs
          </div>
          {groupList.results.map((group) => {
            const groupKey = `${group.currentBrand.id}:${group.targetBrand.id}:${
              group.suggestedDistillery?.id ?? "none"
            }`;

            return (
              <div
                key={groupKey}
                className="rounded-xl border border-slate-800 bg-slate-950 p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-200">
                        {group.currentBrand.name} -&gt; {group.targetBrand.name}
                      </span>
                      <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-300">
                        {group.candidateCount.toLocaleString()} bottles
                      </span>
                      <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-300">
                        {formatTastingCount(group.totalTastings)} tastings
                      </span>
                      {group.suggestedDistillery ? (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-200">
                          Keep {group.suggestedDistillery.name} as distillery
                        </span>
                      ) : null}
                    </div>
                    <div className="text-sm text-slate-300">
                      These bottles already carry stronger leading producer
                      evidence for {group.targetBrand.name}. Apply the group to
                      move the verified subset without touching the survivors
                      that do not support the same target.
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button href={`/entities/${group.currentBrand.id}`}>
                      Open Current Brand
                    </Button>
                    <Button href={`/entities/${group.targetBrand.id}`}>
                      Open Suggested Brand
                    </Button>
                    <Button
                      color="highlight"
                      disabled={repairingGroupKey === groupKey}
                      loading={repairingGroupKey === groupKey}
                      onClick={() =>
                        applyGroupRepair({
                          currentBrandId: group.currentBrand.id,
                          currentBrandName: group.currentBrand.name,
                          distilleryId: group.suggestedDistillery?.id ?? null,
                          distilleryName:
                            group.suggestedDistillery?.name ?? null,
                          targetBrandId: group.targetBrand.id,
                          targetBrandName: group.targetBrand.name,
                        })
                      }
                    >
                      Apply {group.candidateCount.toLocaleString()} Repairs
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  {group.sampleBottles.map((sample) => (
                    <div
                      key={`${groupKey}:${sample.bottle.id}`}
                      className="rounded-lg border border-slate-800 bg-slate-900 p-4"
                    >
                      <Link
                        href={`/bottles/${sample.bottle.id}`}
                        className="block text-sm font-medium text-white hover:text-slate-300"
                      >
                        {sample.bottle.fullName}
                      </Link>
                      <div className="mt-1 text-xs text-slate-400">
                        {formatTastingCount(sample.bottle.totalTastings)}{" "}
                        tastings and {sample.bottle.numReleases} child releases
                      </div>
                      <div className="mt-3 space-y-2">
                        {sample.supportingReferences.map((reference, index) => (
                          <div
                            key={`${sample.bottle.id}-${reference.source}-${index}`}
                            className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"
                          >
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-medium text-slate-300">
                                {reference.source === "alias"
                                  ? "Alias"
                                  : "Full name"}
                              </span>
                              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-200">
                                Matches {reference.targetMatchedName}
                              </span>
                            </div>
                            <div className="mt-2 text-xs text-slate-300">
                              {reference.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-500">
        Individual Bottles
      </div>

      {candidateList.results.length === 0 ? (
        <EmptyActivity>
          {currentQuery
            ? "No brand/entity repairs matched that search."
            : "No brand/entity repairs right now."}
        </EmptyActivity>
      ) : (
        <div className="space-y-4">
          {candidateList.results.map((candidate) => (
            <div
              key={candidate.bottle.id}
              className="rounded-xl border border-slate-800 bg-slate-950 p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-200">
                      {candidate.currentBrand.name} -&gt;{" "}
                      {candidate.targetBrand.name}
                    </span>
                    {candidate.suggestedDistillery ? (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-200">
                        Keep {candidate.suggestedDistillery.name} as distillery
                      </span>
                    ) : null}
                  </div>
                  <Link
                    href={`/bottles/${candidate.bottle.id}`}
                    className="block text-lg font-semibold text-white hover:text-slate-300"
                  >
                    {candidate.bottle.fullName}
                  </Link>
                  <div className="mt-1 text-sm text-slate-400">
                    {formatTastingCount(candidate.bottle.totalTastings)}{" "}
                    tastings and {candidate.bottle.numReleases} child releases
                    on this bottle row.
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button href={`/bottles/${candidate.bottle.id}`}>
                    Open Bottle
                  </Button>
                  <Button href={`/entities/${candidate.currentBrand.id}`}>
                    Open Current Brand
                  </Button>
                  <Button href={`/entities/${candidate.targetBrand.id}`}>
                    Open Suggested Brand
                  </Button>
                  <Button
                    color="highlight"
                    disabled={repairingBottleId === candidate.bottle.id}
                    loading={repairingBottleId === candidate.bottle.id}
                    onClick={() =>
                      applyRepair({
                        bottleId: candidate.bottle.id,
                        bottleName: candidate.bottle.fullName,
                        currentBrandId: candidate.currentBrand.id,
                        currentBrandName: candidate.currentBrand.name,
                        targetBrandId: candidate.targetBrand.id,
                        targetBrandName: candidate.targetBrand.name,
                        distilleryId: candidate.suggestedDistillery?.id ?? null,
                        distilleryName:
                          candidate.suggestedDistillery?.name ?? null,
                      })
                    }
                  >
                    Apply Repair
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Current Stored Brand
                  </div>
                  <Link
                    href={`/entities/${candidate.currentBrand.id}`}
                    className="mt-2 block text-sm font-medium text-white hover:text-slate-300"
                  >
                    {candidate.currentBrand.name}
                  </Link>
                  <div className="mt-2 text-sm text-slate-400">
                    {candidate.currentBrand.totalBottles.toLocaleString()}{" "}
                    bottles and{" "}
                    {candidate.currentBrand.totalTastings.toLocaleString()}{" "}
                    tastings currently roll up to this entity.
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-emerald-200">
                    Suggested Brand Repair
                  </div>
                  <Link
                    href={`/entities/${candidate.targetBrand.id}`}
                    className="mt-2 block text-sm font-medium text-white hover:text-slate-300"
                  >
                    {candidate.targetBrand.name}
                  </Link>
                  <div className="mt-2 text-sm text-slate-300">
                    {candidate.targetBrand.totalBottles.toLocaleString()}{" "}
                    bottles and{" "}
                    {candidate.targetBrand.totalTastings.toLocaleString()}{" "}
                    tastings already roll up to the suggested target.
                  </div>
                  {candidate.suggestedDistillery ? (
                    <div className="mt-2 text-sm text-slate-300">
                      The repair will also keep{" "}
                      {candidate.suggestedDistillery.name} as a distillery link.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Supporting Names And Aliases
                </div>
                <div className="mt-3 space-y-3">
                  {candidate.supportingReferences.map((reference, index) => (
                    <div
                      key={`${candidate.bottle.id}-${reference.source}-${index}`}
                      className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"
                    >
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-300">
                          {reference.source === "alias"
                            ? "Bottle alias"
                            : "Bottle full name"}
                        </span>
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-200">
                          Matches {reference.targetMatchedName}
                        </span>
                        {reference.currentBrandMatchedName ? (
                          <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-400">
                            Current brand only matches{" "}
                            {reference.currentBrandMatchedName}
                          </span>
                        ) : (
                          <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-400">
                            Current brand does not match this leading text
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-sm text-slate-300">
                        {reference.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <PaginationButtons rel={candidateList.rel} />
        </div>
      )}
    </>
  );
}
