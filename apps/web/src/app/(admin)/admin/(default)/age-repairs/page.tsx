"use client";

import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
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

const REPAIR_MODE_LABELS = {
  existing_release: "Existing Age Release",
  create_release: "Needs Age Release",
} as const;

function formatTastingCount(value: null | number): string {
  return (value ?? 0).toLocaleString();
}

function getRepairModeDescription(repairMode: keyof typeof REPAIR_MODE_LABELS) {
  switch (repairMode) {
    case "existing_release":
      return "An existing age-specific release already exists and will absorb the former bottle-level parent age.";
    case "create_release":
      return "A new child release will be created for the former bottle-level parent age.";
  }
}

function getApplyRepairLabel(repairMode: keyof typeof REPAIR_MODE_LABELS) {
  return repairMode === "create_release"
    ? "Create Release + Apply"
    : "Apply Repair";
}

function buildAgeRepairHref(
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
  const candidateListQueryOptions =
    orpc.bottles.ageRepairCandidates.queryOptions({
      input: queryParams,
    });
  const { data: candidateList } = useSuspenseQuery(candidateListQueryOptions);
  const applyRepairMutation = useMutation(
    orpc.bottles.applyAgeRepair.mutationOptions(),
  );

  const applyRepair = async ({
    bottleId,
    bottleName,
    targetReleaseName,
    repairMode,
  }: {
    bottleId: number;
    bottleName: string;
    repairMode: keyof typeof REPAIR_MODE_LABELS;
    targetReleaseName: string;
  }) => {
    setRepairingBottleId(bottleId);
    try {
      await applyRepairMutation.mutateAsync({
        bottle: bottleId,
      });
      await queryClient.invalidateQueries({
        queryKey: candidateListQueryOptions.queryKey,
      });
      flash(
        repairMode === "create_release"
          ? `Created ${targetReleaseName} from ${bottleName}.`
          : `Moved ${bottleName} into ${targetReleaseName}.`,
      );
    } catch (err) {
      flash(
        err instanceof Error ? err.message : "Unable to apply age repair.",
        "error",
      );
    } finally {
      setRepairingBottleId(null);
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
            name: "Age Repairs",
            href: "/admin/age-repairs",
            current: true,
          },
        ]}
      />

      <SimpleHeader>Age Repairs</SimpleHeader>

      <div className="mb-6 space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-4 text-sm text-slate-300">
          High-confidence parent bottles whose structured bottle-level age is
          dirty because child releases already carry different ages. Applying a
          repair creates or reuses the former parent-age release, moves direct
          bottle-scoped rows onto it, and clears the parent age.
        </div>

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
                placeholder="Search dirty parent bottle names"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" color="primary">
                Search
              </Button>
              {currentQuery ? (
                <Button
                  href={buildAgeRepairHref(pathname, searchParams, {
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

      {candidateList.results.length > 0 ? (
        <div className="space-y-4">
          {candidateList.results.map((candidate) => (
            <div
              key={candidate.bottle.id}
              className="rounded-xl border border-slate-800 bg-slate-950 p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-300">
                      {REPAIR_MODE_LABELS[candidate.repairMode]}
                    </span>
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-400">
                      Parent age {candidate.bottle.statedAge}
                    </span>
                  </div>
                  <Link
                    href={`/bottles/${candidate.bottle.id}`}
                    className="block text-lg font-semibold text-white hover:text-slate-300"
                  >
                    {candidate.bottle.fullName}
                  </Link>
                  <div className="mt-1 text-sm text-slate-400">
                    {formatTastingCount(candidate.bottle.totalTastings)}{" "}
                    tastings on the parent bottle
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button href={`/bottles/${candidate.bottle.id}`}>
                    Open Parent Bottle
                  </Button>
                  {candidate.targetRelease.id ? (
                    <Button
                      href={`/bottles/${candidate.bottle.id}/bottlings/${candidate.targetRelease.id}`}
                    >
                      Open Target Release
                    </Button>
                  ) : null}
                  <Button
                    color="highlight"
                    disabled={repairingBottleId === candidate.bottle.id}
                    loading={repairingBottleId === candidate.bottle.id}
                    onClick={() =>
                      applyRepair({
                        bottleId: candidate.bottle.id,
                        bottleName: candidate.bottle.fullName,
                        targetReleaseName: candidate.targetRelease.fullName,
                        repairMode: candidate.repairMode,
                      })
                    }
                  >
                    {getApplyRepairLabel(candidate.repairMode)}
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Target Release
                  </div>
                  {candidate.targetRelease.id ? (
                    <Link
                      href={`/bottles/${candidate.bottle.id}/bottlings/${candidate.targetRelease.id}`}
                      className="mt-2 block text-sm font-medium text-white hover:text-slate-300"
                    >
                      {candidate.targetRelease.fullName}
                    </Link>
                  ) : (
                    <div className="mt-2 text-sm font-medium text-white">
                      {candidate.targetRelease.fullName}
                    </div>
                  )}
                  <div className="mt-2 text-sm text-slate-400">
                    {candidate.repairMode === "existing_release"
                      ? `${formatTastingCount(candidate.targetRelease.totalTastings)} tastings on the existing age release.`
                      : getRepairModeDescription(candidate.repairMode)}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Conflicting Child Releases
                  </div>
                  <div className="mt-3 flex flex-col gap-2 text-sm">
                    {candidate.conflictingReleases.map((release) => (
                      <Link
                        key={release.id}
                        href={`/bottles/${candidate.bottle.id}/bottlings/${release.id}`}
                        className="text-slate-300 hover:text-white"
                      >
                        {release.fullName}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-10">
          <div className="text-sm text-slate-400">
            No dirty parent age repairs found.
          </div>
        </div>
      )}

      <PaginationButtons rel={candidateList.rel} />
    </>
  );
}
