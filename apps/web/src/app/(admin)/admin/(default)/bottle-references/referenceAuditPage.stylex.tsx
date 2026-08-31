"use client";

import type { Inputs, Outputs } from "@peated/server/orpc/router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AdminButton } from "@peated/web/components/admin/adminButton.stylex";
import {
  AdminActions,
  AdminBreadcrumbs,
  AdminPage,
  AdminPageHeader,
  AdminStatus,
  AdminTextLink,
} from "@peated/web/components/admin/adminContent.stylex";
import { AdminTable } from "@peated/web/components/admin/adminTable.stylex";
import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import { useORPC } from "@peated/web/lib/orpc/context";

type AuditInput = NonNullable<Inputs["admin"]["referenceAudit"]>;
type AuditItem = Outputs["admin"]["referenceAudit"]["results"][number];
type AuditSignal = NonNullable<AuditInput["signal"]>;

const issueOptions = [
  { value: "smws_conflict", label: "Different SMWS code" },
  { value: "age_conflict", label: "Different age" },
  { value: "vintage_year_conflict", label: "Different vintage year" },
  { value: "release_year_conflict", label: "Different release year" },
  { value: "abv_conflict", label: "Different ABV" },
  { value: "edition_conflict", label: "Different edition" },
  { value: "cask_conflict", label: "Different cask" },
  { value: "normalized_overlap", label: "Same name after cleanup" },
  { value: "generic_prefix", label: "Name is too broad" },
  { value: "sibling_ambiguity", label: "Could match another Bottle" },
] as const satisfies ReadonlyArray<{ value: AuditSignal; label: string }>;

function parseReviewState(value: string): AuditInput["reviewState"] {
  if (value === "reviewed" || value === "unreviewed") return value;
  return "all";
}

function parseSignal(value: string): AuditInput["signal"] {
  return issueOptions.find((option) => option.value === value)?.value;
}

function assignmentLabel(value: string) {
  switch (value) {
    case "human_approved":
      return "Added by a moderator";
    case "classifier_approved":
      return "Approved after classification";
    case "source_approved":
      return "Approved from a source";
    case "canonical":
      return "Primary name";
    case "legacy":
      return "Existing data";
    default:
      return value.replaceAll("_", " ");
  }
}

export default function BottleReferenceAuditPage() {
  const orpc = useORPC();
  const { flash } = useFlashMessages();
  const [after, setAfter] = useState(0);
  const [previous, setPrevious] = useState<number[]>([]);
  const [reviewState, setReviewState] =
    useState<AuditInput["reviewState"]>("unreviewed");
  const [signal, setSignal] = useState<AuditInput["signal"]>();
  const query = useQuery(
    orpc.admin.referenceAudit.queryOptions({
      input: { after, limit: 50, reviewState, signal },
    }),
  );
  const review = useMutation(orpc.bottleReferences.review.mutationOptions());
  const createAlias = useMutation(orpc.bottleAliases.create.mutationOptions());
  const deleteAlias = useMutation(orpc.bottleAliases.delete.mutationOptions());

  async function run(
    action: () => Promise<object>,
    success: string,
  ): Promise<void> {
    try {
      await action();
      flash(success);
      await query.refetch();
    } catch (error) {
      flash(
        error instanceof Error
          ? error.message
          : "We couldn't update this name. Reload and try again.",
        "error",
      );
    }
  }

  const columns = [
    {
      name: "matched name",
      value: (item: AuditItem) => (
        <div>
          <strong>{item.name}</strong>
          <div>{assignmentLabel(item.assignmentSource)}</div>
        </div>
      ),
    },
    {
      name: "Bottle",
      value: (item: AuditItem) => (
        <div>
          <AdminTextLink href={`/bottles/${item.bottle.id}`}>
            {item.bottle.fullName}
          </AdminTextLink>
          <div>
            {item.group.siblings.length} other Bottle
            {item.group.siblings.length === 1 ? "" : "s"} in this group
          </div>
        </div>
      ),
    },
    {
      name: "possible issues",
      value: (item: AuditItem) =>
        item.signals.length
          ? item.signals.map(({ message }) => message).join(" ")
          : "No listed issues",
    },
    {
      name: "current uses",
      value: (item: AuditItem) => (
        <div>
          <div>
            {item.impact.prices.count} price
            {item.impact.prices.count === 1 ? "" : "s"}
            {item.impact.prices.ids.length
              ? ` (IDs ${item.impact.prices.ids.join(", ")})`
              : ""}
          </div>
          <div>
            {item.impact.reviews.count} review
            {item.impact.reviews.count === 1 ? "" : "s"}
            {item.impact.reviews.ids.length
              ? ` (IDs ${item.impact.reviews.ids.join(", ")})`
              : ""}
          </div>
        </div>
      ),
    },
    {
      name: "review",
      value: (item: AuditItem) => (
        <AdminStatus tone={item.reviewedAt ? "success" : "warning"}>
          {item.reviewedAt ? "Reviewed" : "Needs review"}
        </AdminStatus>
      ),
    },
    {
      align: "right" as const,
      name: "actions",
      value: (item: AuditItem) => (
        <AdminActions>
          <AdminButton
            disabled={review.isPending}
            onClick={() =>
              void run(
                () =>
                  review.mutateAsync({
                    reference: item.id,
                    action: "verify",
                    stateToken: item.stateToken,
                  }),
                "This name will keep matching this Bottle.",
              )
            }
            size="sm"
          >
            Keep matching
          </AdminButton>
          <AdminButton
            variant="danger"
            disabled={review.isPending}
            onClick={() => {
              if (
                window.confirm(
                  `Stop using “${item.name}” to match new imports? Existing ${item.impact.prices.count} prices and ${item.impact.reviews.count} reviews will stay on this Bottle.`,
                )
              ) {
                void run(
                  () =>
                    review.mutateAsync({
                      reference: item.id,
                      action: "quarantine",
                      stateToken: item.stateToken,
                    }),
                  "This name will no longer match new imports. Existing prices and reviews were not changed.",
                );
              }
            }}
            size="sm"
          >
            Stop matching
          </AdminButton>
          <AdminButton
            disabled={createAlias.isPending || deleteAlias.isPending}
            onClick={() =>
              void run(
                () =>
                  item.displayAlias
                    ? deleteAlias.mutateAsync({
                        bottle: item.bottle.id,
                        alias: item.displayAlias.id,
                      })
                    : createAlias.mutateAsync({
                        bottle: item.bottle.id,
                        name: item.name,
                      }),
                item.displayAlias
                  ? "This name is no longer shown on the Bottle page."
                  : "This name is now shown on the Bottle page.",
              )
            }
            size="sm"
          >
            {item.displayAlias ? "Hide name" : "Show name"}
          </AdminButton>
        </AdminActions>
      ),
    },
  ];

  return (
    <AdminPage>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          {
            label: "Bottle name review",
            href: "/admin/bottle-references",
            current: true,
          },
        ]}
      />
      <AdminPageHeader
        title="Bottle name review"
        description="Review names that Peated uses to match imports. Matching and names shown on Bottle pages are separate choices."
      />
      <AdminActions>
        <label>
          Status{" "}
          <select
            value={reviewState}
            onChange={(event) => {
              setAfter(0);
              setPrevious([]);
              setReviewState(parseReviewState(event.currentTarget.value));
            }}
          >
            <option value="all">All</option>
            <option value="unreviewed">Needs review</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </label>
        <label>
          Possible issue{" "}
          <select
            value={signal ?? ""}
            onChange={(event) => {
              setAfter(0);
              setPrevious([]);
              setSignal(parseSignal(event.currentTarget.value));
            }}
          >
            <option value="">All issues</option>
            {issueOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </AdminActions>
      {query.data ? (
        <AdminTable
          columns={columns}
          items={query.data.results}
          primaryKey={(item) => String(item.id)}
        />
      ) : null}
      <AdminActions>
        <AdminButton
          disabled={!previous.length}
          onClick={() => {
            const values = [...previous];
            setAfter(values.pop() ?? 0);
            setPrevious(values);
          }}
        >
          Previous
        </AdminButton>
        <AdminButton
          disabled={!query.data?.nextCursor}
          onClick={() => {
            if (!query.data?.nextCursor) return;
            setPrevious((values) => [...values, after]);
            setAfter(query.data.nextCursor!);
          }}
        >
          Next
        </AdminButton>
      </AdminActions>
    </AdminPage>
  );
}
