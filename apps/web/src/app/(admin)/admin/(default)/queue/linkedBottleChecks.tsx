"use client";

import type { Outputs } from "@peated/server/orpc/router";
import CheckResult from "@peated/web/components/bottleChecks/checkResult";
import OperationCard from "@peated/web/components/bottleChecks/operationCard";
import { getBottleCheckRefetchInterval } from "@peated/web/components/bottleChecks/polling";
import Link from "@peated/web/components/link";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

type BottleCheckDetails = Outputs["bottleChecks"]["details"];

export function LinkedBottleCheckDetails({
  details,
}: {
  details: BottleCheckDetails;
}) {
  const reviewByOperation = useMemo(
    () =>
      new Map(
        details.reviewOperations.map(({ operationId, review }) => [
          operationId,
          review,
        ]),
      ),
    [details.reviewOperations],
  );

  return (
    <section className="space-y-4" data-bottle-check-id={details.check.id}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">
          Supplemental catalog review
        </div>
        <Link
          className="text-sm underline"
          href={`/bottle-checks/${details.check.id}`}
        >
          Review Bottle check #{details.check.id}
        </Link>
      </div>

      <CheckResult check={details.check} title="Supplemental Bottle check" />

      {details.check.operations.length > 0 ? (
        <div className="space-y-3">
          {details.check.operations.map((operation) => (
            <OperationCard
              key={operation.id}
              operation={operation}
              review={reviewByOperation.get(operation.id) ?? null}
              showDisposition={false}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function LinkedBottleCheck({ checkId }: { checkId: number }) {
  const orpc = useORPC();
  const detailsOptions = orpc.bottleChecks.details.queryOptions({
    input: { check: checkId },
  });
  const detailsQuery = useQuery({
    ...detailsOptions,
    refetchInterval: (query) => getBottleCheckRefetchInterval(query.state.data),
  });

  if (detailsQuery.isPending) {
    return (
      <div className="text-sm text-slate-400">
        Loading Bottle check #{checkId}…
      </div>
    );
  }
  if (detailsQuery.isError) {
    return (
      <div className="text-sm text-red-200">
        Bottle check #{checkId} could not be loaded.
      </div>
    );
  }

  return <LinkedBottleCheckDetails details={detailsQuery.data} />;
}

export default function LinkedBottleChecks({
  checkIds,
}: {
  checkIds: number[];
}) {
  const [open, setOpen] = useState(false);

  if (checkIds.length === 0) {
    return null;
  }

  return (
    <details
      className="mt-5 border-t border-slate-800 pt-5"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-sm font-semibold text-white">
        Supplemental Bottle {checkIds.length === 1 ? "check" : "checks"} (
        {checkIds.length})
      </summary>
      {open ? (
        <div className="mt-5 space-y-5">
          {checkIds.map((checkId) => (
            <LinkedBottleCheck checkId={checkId} key={checkId} />
          ))}
        </div>
      ) : null}
    </details>
  );
}
