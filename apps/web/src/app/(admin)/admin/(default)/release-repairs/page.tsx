"use client";

import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import ConfirmationButton from "@peated/web/components/confirmationButton";
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

const MARKER_LABELS: Record<string, string> = {
  structured_edition: "Structured edition",
  name_batch: "Name batch marker",
  structured_release_year: "Structured release year",
  name_release_year: "Name release year",
};

const REPAIR_MODE_LABELS = {
  existing_parent: "Reusable parent exists",
  create_parent: "Needs parent creation",
  blocked_classifier: "Classifier review blocked",
  blocked_alias_conflict: "Parent alias is blocked",
  blocked_dirty_parent: "Dirty parent blocks repair",
} as const;

const RESOLUTION_SOURCE_LABELS = {
  heuristic_exact: "Exact parent match",
  heuristic_variant: "Variant parent match",
  classifier_review_persisted: "Persisted classifier review",
  classifier_review_live: "Live classifier review",
} as const;

const REVIEW_STATE_LABELS = {
  fresh_allow_create_parent: "Reviewed create-parent",
  fresh_blocked: "Reviewed blocked",
  fresh_reuse_existing_parent: "Reviewed reusable parent",
  stale_review: "Stale review",
  unreviewed: "Unreviewed",
} as const;

function formatTastingCount(value: null | number): string {
  return (value ?? 0).toLocaleString();
}

function getRepairModeDescription(repairMode: keyof typeof REPAIR_MODE_LABELS) {
  switch (repairMode) {
    case "existing_parent":
      return "An existing reusable parent bottle can absorb this legacy release directly.";
    case "create_parent":
      return "A new reusable parent bottle will be created during repair.";
    case "blocked_classifier":
      return "Classifier review could not verify whether this legacy bottle should reuse an existing parent or create a new one.";
    case "blocked_alias_conflict":
      return "The proposed parent name is already owned by a different bottle or release alias and needs manual cleanup first.";
    case "blocked_dirty_parent":
      return "A matching parent bottle exists, but it still carries release traits. Repair that parent first, then retry the legacy child.";
  }
}

function getResolutionSourceDescription(
  parentResolutionSource: keyof typeof RESOLUTION_SOURCE_LABELS | null,
) {
  switch (parentResolutionSource) {
    case "heuristic_exact":
      return "This repair reuses an exact parent match from the current bottle data.";
    case "heuristic_variant":
      return "This repair reuses a variant/generic parent match from the current bottle data.";
    case "classifier_review_persisted":
      return "This repair reuses a persisted classifier-reviewed parent decision.";
    case "classifier_review_live":
      return "This repair reuses a live classifier-reviewed parent decision.";
    case null:
      return null;
  }
}

function getReviewStateDescription(
  reviewState: keyof typeof REVIEW_STATE_LABELS | null,
) {
  switch (reviewState) {
    case "fresh_allow_create_parent":
      return "Classifier review still supports creating a new reusable parent bottle.";
    case "fresh_blocked":
      return "Stored classifier review currently blocks this repair.";
    case "fresh_reuse_existing_parent":
      return "Stored classifier review currently supports reusing an existing parent bottle.";
    case "stale_review":
      return "A stored review exists, but the legacy bottle or parent set changed and it needs refresh.";
    case "unreviewed":
      return "This create-parent repair has not been classifier-reviewed yet.";
    case null:
      return null;
  }
}

function canApplyRepair(repairMode: keyof typeof REPAIR_MODE_LABELS) {
  return (
    repairMode !== "blocked_classifier" &&
    repairMode !== "blocked_dirty_parent" &&
    repairMode !== "blocked_alias_conflict"
  );
}

function getApplyRepairLabel(repairMode: keyof typeof REPAIR_MODE_LABELS) {
  return repairMode === "create_parent"
    ? "Create Parent + Apply"
    : "Apply Repair";
}

function buildReleaseRepairHref(
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
  const [repairingDirtyParentBottleId, setRepairingDirtyParentBottleId] =
    useState<number | null>(null);
  const [clearingAliasName, setClearingAliasName] = useState<null | string>(
    null,
  );
  const candidateListQueryOptions =
    orpc.bottles.releaseRepairCandidates.queryOptions({
      input: queryParams,
    });
  const { data: candidateList } = useSuspenseQuery(candidateListQueryOptions);
  const applyRepairMutation = useMutation(
    orpc.bottles.applyReleaseRepair.mutationOptions(),
  );
  const applyDirtyParentRepairMutation = useMutation(
    orpc.bottles.applyDirtyParentReleaseRepair.mutationOptions(),
  );
  const deleteBottleAliasMutation = useMutation(
    orpc.bottleAliases.delete.mutationOptions(),
  );

  const applyRepair = async ({
    bottleId,
    legacyBottleName,
    parentBottleName,
    repairMode,
  }: {
    bottleId: number;
    legacyBottleName: string;
    parentBottleName: string;
    repairMode: keyof typeof REPAIR_MODE_LABELS;
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
        repairMode === "create_parent"
          ? `Created ${parentBottleName} and moved ${legacyBottleName}.`
          : `Moved ${legacyBottleName} under ${parentBottleName}.`,
      );
    } catch (err) {
      flash(
        err instanceof Error ? err.message : "Unable to apply release repair.",
        "error",
      );
    } finally {
      setRepairingBottleId(null);
    }
  };

  const clearBlockingAlias = async ({
    aliasName,
    legacyBottleName,
    parentBottleName,
  }: {
    aliasName: string;
    legacyBottleName: string;
    parentBottleName: string;
  }) => {
    setClearingAliasName(aliasName);
    try {
      await deleteBottleAliasMutation.mutateAsync({
        alias: aliasName,
      });
      await queryClient.invalidateQueries({
        queryKey: candidateListQueryOptions.queryKey,
      });
      flash(
        `Cleared the blocking alias for ${parentBottleName}. ${legacyBottleName} can now be repaired.`,
      );
    } catch (err) {
      flash(
        err instanceof Error ? err.message : "Unable to clear blocking alias.",
        "error",
      );
    } finally {
      setClearingAliasName(null);
    }
  };

  const repairDirtyParent = async ({
    blockingParentId,
    blockingParentName,
    legacyBottleName,
  }: {
    blockingParentId: number;
    blockingParentName: string;
    legacyBottleName: string;
  }) => {
    setRepairingDirtyParentBottleId(blockingParentId);
    try {
      await applyDirtyParentRepairMutation.mutateAsync({
        bottle: blockingParentId,
      });
      await queryClient.invalidateQueries({
        queryKey: candidateListQueryOptions.queryKey,
      });
      flash(
        `Repaired ${blockingParentName}. ${legacyBottleName} can now be applied under the cleaned parent.`,
      );
    } catch (err) {
      flash(
        err instanceof Error
          ? err.message
          : "Unable to repair the dirty parent bottle.",
        "error",
      );
    } finally {
      setRepairingDirtyParentBottleId(null);
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
            name: "Release Repairs",
            href: "/admin/release-repairs",
            current: true,
          },
        ]}
      />

      <SimpleHeader>Release Repairs</SimpleHeader>

      <div className="mb-6 space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-4 text-sm text-slate-300">
          High-confidence legacy bottles that likely need to be split into a
          reusable parent bottle plus child releases. Existing-parent and
          create-parent candidates can be applied directly here. Blocked
          parent-name alias conflicts still need manual follow-up.
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
                placeholder="Search legacy bottle names"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" color="primary">
                Search
              </Button>
              {currentQuery ? (
                <Button
                  href={buildReleaseRepairHref(pathname, searchParams, {
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
              key={candidate.legacyBottle.id}
              className="rounded-xl border border-slate-800 bg-slate-950 p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-300">
                      {REPAIR_MODE_LABELS[candidate.repairMode]}
                    </span>
                    {candidate.parentResolutionSource ? (
                      <span className="rounded-full border border-emerald-800 bg-emerald-950 px-2 py-1 text-xs font-medium text-emerald-300">
                        {
                          RESOLUTION_SOURCE_LABELS[
                            candidate.parentResolutionSource
                          ]
                        }
                      </span>
                    ) : null}
                    {candidate.reviewState ? (
                      <span className="rounded-full border border-sky-800 bg-sky-950 px-2 py-1 text-xs font-medium text-sky-300">
                        {REVIEW_STATE_LABELS[candidate.reviewState]}
                      </span>
                    ) : null}
                    {candidate.releaseIdentity.markerSources.map((source) => (
                      <span
                        key={source}
                        className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-400"
                      >
                        {MARKER_LABELS[source] ?? source}
                      </span>
                    ))}
                  </div>
                  <Link
                    href={`/bottles/${candidate.legacyBottle.id}`}
                    className="block text-lg font-semibold text-white hover:text-slate-300"
                  >
                    {candidate.legacyBottle.fullName}
                  </Link>
                  <div className="mt-1 text-sm text-slate-400">
                    {formatTastingCount(candidate.legacyBottle.totalTastings)}{" "}
                    tastings on legacy bottle
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button href={`/bottles/${candidate.legacyBottle.id}`}>
                    Open Legacy Bottle
                  </Button>
                  {candidate.proposedParent.id ? (
                    <Button href={`/bottles/${candidate.proposedParent.id}`}>
                      Open Parent Bottle
                    </Button>
                  ) : null}
                  {candidate.repairMode === "blocked_alias_conflict" &&
                  candidate.blockingAlias?.bottleId ? (
                    <Button
                      href={`/bottles/${candidate.blockingAlias.bottleId}`}
                    >
                      Open Blocking Bottle
                    </Button>
                  ) : null}
                  {candidate.repairMode === "blocked_alias_conflict" &&
                  candidate.blockingAlias ? (
                    <ConfirmationButton
                      className={`inline-flex justify-center rounded border px-3 py-2 text-sm font-semibold shadow-sm ${
                        clearingAliasName === candidate.blockingAlias.name
                          ? "text-muted cursor-auto border-red-900 bg-red-900"
                          : "cursor-pointer border-red-700 bg-red-700 text-white hover:bg-red-600"
                      }`}
                      onContinue={() =>
                        clearBlockingAlias({
                          aliasName: candidate.blockingAlias!.name,
                          legacyBottleName: candidate.legacyBottle.fullName,
                          parentBottleName: candidate.proposedParent.fullName,
                        })
                      }
                      disabled={
                        clearingAliasName === candidate.blockingAlias.name
                      }
                    >
                      Clear Blocking Alias
                    </ConfirmationButton>
                  ) : null}
                  {candidate.repairMode === "blocked_dirty_parent" &&
                  candidate.blockingParent ? (
                    <>
                      <Button href={`/bottles/${candidate.blockingParent.id}`}>
                        Open Blocking Parent
                      </Button>
                      <Button
                        color="highlight"
                        disabled={
                          repairingDirtyParentBottleId ===
                          candidate.blockingParent.id
                        }
                        loading={
                          repairingDirtyParentBottleId ===
                          candidate.blockingParent.id
                        }
                        onClick={() =>
                          repairDirtyParent({
                            blockingParentId: candidate.blockingParent!.id,
                            blockingParentName:
                              candidate.blockingParent!.fullName,
                            legacyBottleName: candidate.legacyBottle.fullName,
                          })
                        }
                      >
                        Repair Dirty Parent
                      </Button>
                    </>
                  ) : null}
                  {canApplyRepair(candidate.repairMode) ? (
                    <Button
                      color="highlight"
                      disabled={repairingBottleId === candidate.legacyBottle.id}
                      loading={repairingBottleId === candidate.legacyBottle.id}
                      onClick={() =>
                        applyRepair({
                          bottleId: candidate.legacyBottle.id,
                          legacyBottleName: candidate.legacyBottle.fullName,
                          parentBottleName: candidate.proposedParent.fullName,
                          repairMode: candidate.repairMode,
                        })
                      }
                    >
                      {getApplyRepairLabel(candidate.repairMode)}
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Proposed Parent
                  </div>
                  {candidate.proposedParent.id ? (
                    <Link
                      href={`/bottles/${candidate.proposedParent.id}`}
                      className="mt-2 block text-sm font-medium text-white hover:text-slate-300"
                    >
                      {candidate.proposedParent.fullName}
                    </Link>
                  ) : (
                    <div className="mt-2 text-sm font-medium text-white">
                      {candidate.proposedParent.fullName}
                    </div>
                  )}
                  <div className="mt-2 text-sm text-slate-400">
                    {candidate.repairMode === "existing_parent"
                      ? `${formatTastingCount(candidate.proposedParent.totalTastings)} tastings on the existing parent bottle.`
                      : getRepairModeDescription(candidate.repairMode)}
                  </div>
                  {candidate.parentResolutionSource ? (
                    <div className="mt-3 text-sm text-emerald-300">
                      {getResolutionSourceDescription(
                        candidate.parentResolutionSource,
                      )}
                    </div>
                  ) : null}
                  {candidate.reviewState ? (
                    <div className="mt-3 text-sm text-sky-300">
                      {getReviewStateDescription(candidate.reviewState)}
                    </div>
                  ) : null}
                  {candidate.blockingAlias ? (
                    <div className="mt-3 text-sm text-amber-300">
                      Blocking alias currently points to{" "}
                      {candidate.blockingAlias.releaseFullName ??
                        candidate.blockingAlias.bottleFullName ??
                        "another record"}
                      .
                    </div>
                  ) : null}
                  {candidate.blockingParent ? (
                    <div className="mt-3 text-sm text-amber-300">
                      Blocking parent currently lives on{" "}
                      <Link
                        href={`/bottles/${candidate.blockingParent.id}`}
                        className="text-amber-200 hover:text-white"
                      >
                        {candidate.blockingParent.fullName}
                      </Link>
                      .
                    </div>
                  ) : null}
                  {candidate.classifierBlocker ? (
                    <div className="mt-3 text-sm text-amber-300">
                      {candidate.classifierBlocker}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Release Identity
                  </div>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-slate-500">Edition</dt>
                      <dd className="text-right text-white">
                        {candidate.releaseIdentity.edition ?? "\u2014"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-slate-500">Release Year</dt>
                      <dd className="text-right text-white">
                        {candidate.releaseIdentity.releaseYear ?? "\u2014"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {candidate.siblingLegacyBottles.length > 0 ? (
                <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Sibling Legacy Bottles
                  </div>
                  <div className="mt-3 flex flex-col gap-2 text-sm">
                    {candidate.siblingLegacyBottles.map((sibling) => (
                      <Link
                        key={sibling.id}
                        href={`/bottles/${sibling.id}`}
                        className="text-slate-300 hover:text-white"
                      >
                        {sibling.fullName}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <EmptyActivity>
          {currentQuery
            ? "No legacy release repair candidates match the current search."
            : "No legacy release repair candidates found."}
        </EmptyActivity>
      )}

      <PaginationButtons rel={candidateList.rel} />
    </>
  );
}
