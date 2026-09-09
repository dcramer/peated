"use client";

import { getRatingBandById } from "@peated/server/constants";
import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { usePathname, useSearchParams } from "next/navigation";

import { useSuspenseQuery } from "@tanstack/react-query";
import useApiQueryParams from "../../hooks/useApiQueryParams";
import { useORPC } from "../../lib/orpc/context";
import { buildQueryString } from "../../lib/urls";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, space } from "../../styles/tokens.stylex";
import { Timestamp } from "../timestamp";
import { AdminButton } from "./adminButton.stylex";
import { AdminActions, AdminStatus } from "./adminContent.stylex";
import { AdminTable } from "./adminTable.stylex";
import { AdminEmptyActivity } from "./adminUtility.stylex";

type ContentKind = "member_review" | "external_review" | "tasting";
type ContentStatus = "active" | "removed" | "all";
type ContentItem = Outputs["admin"]["content"]["list"]["results"][number];

const statuses: ReadonlyArray<{ label: string; value: ContentStatus }> = [
  { label: "Active", value: "active" },
  { label: "Removed", value: "removed" },
  { label: "All", value: "all" },
];

export function AdminContentTable({ kind }: { kind: ContentKind }) {
  const orpc = useORPC();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useApiQueryParams({
    allowedValues: { status: ["active", "removed", "all"] },
    defaults: { status: "active" },
    fields: ["cursor", "limit", "query", "status"],
  });
  const status: ContentStatus =
    params.status === "removed" || params.status === "all"
      ? params.status
      : "active";
  const { data } = useSuspenseQuery(
    orpc.admin.content.list.queryOptions({
      input: {
        kind,
        status,
        query: params.query ?? "",
        cursor: params.cursor ?? 1,
        limit: params.limit ?? 25,
      },
    }),
  );

  return (
    <>
      <AdminActions>
        {statuses.map((item) => (
          <AdminButton
            aria-current={status === item.value ? "page" : undefined}
            href={`${pathname}?${buildQueryString(searchParams, {
              cursor: undefined,
              status: item.value,
            })}`}
            key={item.value}
            size="sm"
            variant={status === item.value ? "default" : "tonal"}
          >
            {item.label}
          </AdminButton>
        ))}
      </AdminActions>
      <AdminTable
        columns={[
          {
            fill: true,
            name: "content",
            value: (item) => <ContentSummary item={item} />,
          },
          {
            name: "source",
            value: (item) =>
              item.kind === "external_review"
                ? item.site.name
                : `@${item.member.username}`,
          },
          {
            align: "right",
            name: "rating",
            value: (item) => {
              if (item.kind === "member_review") return `${item.score}`;
              if (item.kind === "external_review") {
                return item.nativeScoreDisplay ?? "—";
              }
              return item.ratingBand
                ? getRatingBandById(item.ratingBand).label
                : "—";
            },
          },
          {
            name: "status",
            value: (item) => (
              <AdminStatus
                tone={item.moderation.removed ? "danger" : "success"}
              >
                {item.moderation.removed ? "Removed" : "Active"}
              </AdminStatus>
            ),
          },
          {
            name: "created",
            value: (item) => <Timestamp date={item.createdAt} format="date" />,
          },
        ]}
        items={data.results}
        noHeaders={!data.results.length}
        rel={data.rel}
        url={contentAdminUrl}
        withSearch
      />
      {!data.results.length ? (
        <AdminEmptyActivity>{emptyMessage(kind)}</AdminEmptyActivity>
      ) : null}
    </>
  );
}

function emptyMessage(kind: ContentKind) {
  if (kind === "member_review") return "No member reviews found.";
  if (kind === "external_review") return "No critic reviews found.";
  return "No tastings found.";
}

function ContentSummary({ item }: { item: ContentItem }) {
  const title =
    item.kind === "external_review" ? item.name : item.bottle.fullName;
  const text = item.kind === "external_review" ? item.clip : item.notes;

  return (
    <div {...stylex.props(styles.summary)}>
      <strong>{title}</strong>
      {text ? (
        <span {...stylex.props(foundationStyles.metadata, styles.excerpt)}>
          {text}
        </span>
      ) : null}
    </div>
  );
}

export function contentAdminUrl(item: Pick<ContentItem, "id" | "kind">) {
  if (item.kind === "member_review") {
    return `/admin/reviews/member/${item.id}`;
  }
  if (item.kind === "external_review") {
    return `/admin/reviews/critics/${item.id}`;
  }
  return `/admin/tastings/${item.id}`;
}

const styles = stylex.create({
  summary: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x1,
  },
  excerpt: {
    color: colors.inkMuted,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});
