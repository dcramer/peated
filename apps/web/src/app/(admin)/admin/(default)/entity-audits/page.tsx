"use client";

import type { Outputs } from "@peated/server/orpc/router";
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

type EntityAuditCandidate =
  Outputs["entities"]["auditCandidates"]["results"][number];
type EntityClassificationResult = Outputs["entities"]["classify"];

function buildPageHref(
  pathname: string,
  searchParams: URLSearchParams,
  nextParams: Record<string, null | number | string | undefined>,
) {
  const queryString = buildQueryString(searchParams, nextParams);
  return queryString ? `${pathname}?${queryString}` : pathname;
}

function buildBrandRepairHref(entityName: string) {
  const queryString = new URLSearchParams({
    query: entityName,
  }).toString();

  return `/admin/brand-repairs?${queryString}`;
}

function formatReasonLabel(
  kind: EntityAuditCandidate["reasons"][number]["kind"],
) {
  switch (kind) {
    case "brand_repair_group":
      return "Bottle evidence";
    case "generic_name":
      return "Generic name";
    case "name_suffix_conflict":
      return "Suffix collision";
    case "metadata_conflict":
      return "Metadata conflict";
    case "manual_audit":
      return "Manual audit";
  }
}

function formatVerdictLabel(
  verdict: EntityClassificationResult["decision"]["verdict"],
) {
  switch (verdict) {
    case "reassign_bottles_to_existing_brand":
      return "Repair bottles";
    case "fix_entity_metadata":
      return "Fix metadata";
    case "possible_duplicate_entity":
      return "Possible duplicate";
    case "generic_or_invalid_brand_row":
      return "Generic or invalid";
    case "manual_review":
      return "Manual review";
    case "keep_as_is":
      return "Keep as-is";
  }
}

function areSameNumberSets(left: number[], right: number[]) {
  if (left.length !== right.length) {
    return false;
  }

  const leftSorted = [...left].sort((a, b) => a - b);
  const rightSorted = [...right].sort((a, b) => a - b);

  return leftSorted.every((value, index) => value === rightSorted[index]);
}

function getApplicableGroupedTarget(
  candidate: EntityAuditCandidate,
  classification: EntityClassificationResult,
) {
  if (
    classification.decision.verdict !== "reassign_bottles_to_existing_brand" ||
    !classification.decision.targetEntityId
  ) {
    return null;
  }

  const matchedTarget = candidate.candidateTargets.find(
    (target) => target.entityId === classification.decision.targetEntityId,
  );
  if (!matchedTarget) {
    return null;
  }

  if (
    !matchedTarget.source.includes("grouped_brand_repair") ||
    matchedTarget.supportingBottleIds.length === 0
  ) {
    return null;
  }

  return areSameNumberSets(
    matchedTarget.supportingBottleIds,
    classification.decision.reassignBottleIds,
  )
    ? matchedTarget
    : null;
}

export default function Page() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get("query") ?? "";
  const queryParams = useApiQueryParams({
    defaults: {
      limit: 25,
      type: "brand",
    },
    numericFields: ["cursor", "limit"],
  });

  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { flash } = useFlashMessages();
  const [runningClassificationEntityId, setRunningClassificationEntityId] =
    useState<null | number>(null);
  const [applyingEntityId, setApplyingEntityId] = useState<null | number>(null);
  const [classificationResults, setClassificationResults] = useState<
    Record<number, EntityClassificationResult | undefined>
  >({});

  const auditCandidatesQueryOptions =
    orpc.entities.auditCandidates.queryOptions({
      input: queryParams,
    });
  const { data } = useSuspenseQuery(auditCandidatesQueryOptions);
  const classifyEntityMutation = useMutation(
    orpc.entities.classify.mutationOptions(),
  );
  const applyGroupRepairMutation = useMutation(
    orpc.bottles.applyBrandRepairGroup.mutationOptions(),
  );

  const runClassification = async (entityId: number) => {
    setRunningClassificationEntityId(entityId);
    try {
      const result = await classifyEntityMutation.mutateAsync({
        entity: entityId,
      });
      setClassificationResults((state) => ({
        ...state,
        [entityId]: result,
      }));
    } catch (err) {
      flash(
        err instanceof Error ? err.message : "Unable to classify entity.",
        "error",
      );
    } finally {
      setRunningClassificationEntityId(null);
    }
  };

  const applyGroupedRepair = async (
    candidate: EntityAuditCandidate,
    classification: EntityClassificationResult,
  ) => {
    const matchedTarget = getApplicableGroupedTarget(candidate, classification);
    if (!matchedTarget) {
      return;
    }

    setApplyingEntityId(candidate.entity.id);
    try {
      const result = await applyGroupRepairMutation.mutateAsync({
        fromBrand: candidate.entity.id,
        toBrand: matchedTarget.entityId,
        distillery: classification.decision.preserveSourceAsDistillery
          ? candidate.entity.id
          : null,
        query: candidate.entity.name,
      });
      await queryClient.invalidateQueries({
        queryKey: auditCandidatesQueryOptions.queryKey,
      });
      setClassificationResults((state) => ({
        ...state,
        [candidate.entity.id]: undefined,
      }));
      flash(
        `Moved ${result.appliedCount} bottles from ${candidate.entity.name} to ${matchedTarget.name}.`,
      );
    } catch (err) {
      flash(
        err instanceof Error ? err.message : "Unable to apply brand repair.",
        "error",
      );
    } finally {
      setApplyingEntityId(null);
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
            name: "Entity Audits",
            href: "/admin/entity-audits",
            current: true,
          },
        ]}
      />

      <SimpleHeader>Entity Audits</SimpleHeader>

      <div className="mb-6 space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-4 text-sm text-slate-300">
          Use this queue when the producer row itself looks wrong. The
          classifier combines local bottle evidence, sibling entity search, and
          web research so you can tell the difference between a real brand, a
          generic junk row, and a source row whose bottles belong under a
          stronger existing brand.
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
                placeholder="Search entity, alias, or target brand names"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" color="primary">
                Search
              </Button>
              {currentQuery ? (
                <Button
                  href={buildPageHref(pathname, searchParams, {
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

      {data.results.length === 0 ? (
        <EmptyActivity>No suspicious entities matched this view.</EmptyActivity>
      ) : (
        <div className="space-y-4">
          {data.results.map((candidate) => {
            const classification = classificationResults[candidate.entity.id];
            const applicableGroupedTarget = classification
              ? getApplicableGroupedTarget(candidate, classification)
              : null;

            return (
              <article
                key={candidate.entity.id}
                className="rounded-xl border border-slate-800 bg-slate-950 p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-200">
                        {candidate.entity.name}
                      </span>
                      <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-300">
                        {candidate.entity.type.join(", ")}
                      </span>
                      <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-300">
                        {candidate.entity.totalBottles.toLocaleString()} bottles
                      </span>
                      <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-300">
                        {candidate.entity.totalTastings.toLocaleString()}{" "}
                        tastings
                      </span>
                    </div>

                    <div className="text-sm text-slate-300">
                      {candidate.entity.aliases.length > 0 ? (
                        <div className="mb-2">
                          <span className="text-slate-500">Aliases:</span>{" "}
                          {candidate.entity.aliases.join(", ")}
                        </div>
                      ) : null}
                      {candidate.entity.website ? (
                        <div className="mb-2">
                          <span className="text-slate-500">Website:</span>{" "}
                          <Link
                            href={candidate.entity.website}
                            className="underline"
                          >
                            {candidate.entity.website}
                          </Link>
                        </div>
                      ) : null}
                      {candidate.entity.countryName ||
                      candidate.entity.regionName ? (
                        <div>
                          <span className="text-slate-500">Location:</span>{" "}
                          {[
                            candidate.entity.countryName,
                            candidate.entity.regionName,
                          ]
                            .filter(Boolean)
                            .join(" / ")}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      color="primary"
                      disabled={
                        runningClassificationEntityId === candidate.entity.id
                      }
                      loading={
                        runningClassificationEntityId === candidate.entity.id
                      }
                      onClick={() => runClassification(candidate.entity.id)}
                    >
                      {runningClassificationEntityId === candidate.entity.id
                        ? "Running Classifier"
                        : "Run Classifier"}
                    </Button>
                    <Button href={buildBrandRepairHref(candidate.entity.name)}>
                      Open Brand Repairs
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                  <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Suspicion Signals
                    </div>
                    <div className="mt-3 space-y-3">
                      {candidate.reasons.map((reason, index) => (
                        <div
                          key={`${reason.kind}:${index}`}
                          className="rounded-lg border border-slate-800 bg-slate-950/80 p-3"
                        >
                          <div className="mb-2 flex flex-wrap gap-2">
                            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-200">
                              {formatReasonLabel(reason.kind)}
                            </span>
                          </div>
                          <div className="text-sm text-white">
                            {reason.summary}
                          </div>
                          {reason.details ? (
                            <div className="mt-1 text-sm text-slate-400">
                              {reason.details}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Candidate Targets
                    </div>
                    <div className="mt-3 space-y-3">
                      {candidate.candidateTargets.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-sm text-slate-500">
                          No stronger local target has been verified yet.
                        </div>
                      ) : (
                        candidate.candidateTargets.map((target) => (
                          <div
                            key={target.entityId}
                            className="rounded-lg border border-slate-800 bg-slate-950/80 p-3"
                          >
                            <div className="mb-2 flex flex-wrap gap-2">
                              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-200">
                                {target.name}
                              </span>
                              <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-300">
                                {target.candidateCount.toLocaleString()} bottles
                              </span>
                              {target.source.map((source) => (
                                <span
                                  key={source}
                                  className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-300"
                                >
                                  {source === "grouped_brand_repair"
                                    ? "Bottle evidence"
                                    : "Sibling name"}
                                </span>
                              ))}
                            </div>
                            <div className="text-sm text-white">
                              {target.reason}
                            </div>
                            {target.aliases.length > 0 ? (
                              <div className="mt-1 text-xs text-slate-500">
                                Aliases: {target.aliases.join(", ")}
                              </div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>

                {candidate.sampleBottles.length > 0 ? (
                  <section className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Sample Bottles
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                      {candidate.sampleBottles.map((bottle) => (
                        <div
                          key={bottle.id}
                          className="rounded-lg border border-slate-800 bg-slate-950/80 p-3"
                        >
                          <div className="text-sm font-medium text-white">
                            {bottle.fullName}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {bottle.category ? `${bottle.category} ` : ""}
                            {bottle.totalTastings !== null
                              ? `(${bottle.totalTastings.toLocaleString()} tastings)`
                              : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {classification ? (
                  <section className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap gap-2">
                          <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-200">
                            {formatVerdictLabel(
                              classification.decision.verdict,
                            )}
                          </span>
                          <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-300">
                            {classification.decision.confidence}% confidence
                          </span>
                          {classification.decision.targetEntityName ? (
                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-200">
                              {classification.decision.targetEntityName}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-sm text-white">
                          {classification.decision.rationale}
                        </div>
                        {classification.decision.blockers.length > 0 ? (
                          <div className="mt-2 text-sm text-amber-200">
                            Blockers:{" "}
                            {classification.decision.blockers.join(", ")}
                          </div>
                        ) : null}
                        {classification.decision.evidenceUrls.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {classification.decision.evidenceUrls.map((url) => (
                              <Link
                                key={url}
                                href={url}
                                className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300"
                              >
                                {url}
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {applicableGroupedTarget ? (
                          <Button
                            color="primary"
                            disabled={applyingEntityId === candidate.entity.id}
                            loading={applyingEntityId === candidate.entity.id}
                            onClick={() =>
                              applyGroupedRepair(candidate, classification)
                            }
                          >
                            {applyingEntityId === candidate.entity.id
                              ? "Applying Repair"
                              : "Apply Verified Repair"}
                          </Button>
                        ) : classification.decision.verdict ===
                            "reassign_bottles_to_existing_brand" &&
                          classification.decision.targetEntityId ? (
                          <Button
                            href={buildBrandRepairHref(candidate.entity.name)}
                          >
                            Review Bottle Repairs
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {classification.decision.verdict ===
                    "fix_entity_metadata" ? (
                      <div className="mt-3 text-sm text-slate-400">
                        Review the entity record manually after validating the
                        suggested metadata changes.
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </article>
            );
          })}

          <PaginationButtons rel={data.rel} />
        </div>
      )}
    </>
  );
}
