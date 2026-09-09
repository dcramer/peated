"use client";

import { getRatingBandById } from "@peated/server/constants";
import type { Outputs } from "@peated/server/orpc/router";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";

import { TextLink } from "..";
import { useORPC } from "../../lib/orpc/context";
import { getBottleUrlFromFullName } from "../../lib/urls";
import { Timestamp } from "../timestamp";
import { AdminButton } from "./adminButton.stylex";
import {
  AdminBreadcrumbs,
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminStatus,
} from "./adminContent.stylex";
import {
  AdminForm,
  AdminFormActions,
  AdminTextareaField,
} from "./adminForm.stylex";
import {
  AdminAlert,
  AdminEmptyActivity,
  AdminDefinitionList as DefinitionList,
} from "./adminUtility.stylex";

type ContentKind = "member_review" | "external_review" | "tasting";
type ContentItem = Outputs["admin"]["content"]["details"];

export function AdminContentDetail({
  id,
  kind,
}: {
  id: number;
  kind: ContentKind;
}) {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { data: item, refetch } = useSuspenseQuery(
    orpc.admin.content.details.queryOptions({ input: { id, kind } }),
  );
  const moderate = useMutation(orpc.admin.content.moderate.mutationOptions());
  const [reason, setReason] = useState("");
  const [saved, setSaved] = useState(false);
  const removing = !item.moderation.removed;
  const listHref =
    kind === "tasting" ? "/admin/tastings" : reviewListHref(kind);
  const title = contentTitle(item);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    try {
      await moderate.mutateAsync({ id, kind, reason, removed: removing });
    } catch {
      return;
    }
    setReason("");
    setSaved(true);
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({
        queryKey: orpc.admin.content.list.key(),
      }),
    ]);
  }

  return (
    <AdminPage>
      <AdminBreadcrumbs
        items={[
          {
            href: kind === "tasting" ? "/admin/tastings" : "/admin/reviews",
            label: kind === "tasting" ? "Tastings" : "Reviews",
          },
          ...(kind === "external_review"
            ? [{ href: listHref, label: "Critic reviews" }]
            : []),
          {
            current: true,
            href:
              kind === "member_review"
                ? `${listHref}/member/${id}`
                : `${listHref}/${id}`,
            label: title,
          },
        ]}
      />
      <AdminPageHeader
        title={title}
        metadata={
          <AdminStatus tone={item.moderation.removed ? "danger" : "success"}>
            {item.moderation.removed ? "Removed" : "Active"}
          </AdminStatus>
        }
      />
      <AdminSection title="Content">
        <ContentFields item={item} />
      </AdminSection>
      <AdminSection
        description={
          removing
            ? "Removed content disappears from public pages but stays here so it can be restored."
            : "Restoring makes this content available on public pages again."
        }
        title={removing ? "Remove from Peated" : "Restore to Peated"}
        tone={removing ? "danger" : "default"}
      >
        {moderate.error ? (
          <AdminAlert>
            We couldn&apos;t save this change. Your reason is still here — try
            again.
          </AdminAlert>
        ) : null}
        {saved ? <AdminAlert type="success">Change saved.</AdminAlert> : null}
        <AdminForm isSubmitting={moderate.isPending} onSubmit={onSubmit}>
          <AdminTextareaField
            helpText="This is kept in the moderation history."
            label="Reason"
            maxLength={500}
            name="reason"
            onChange={(event) => setReason(event.target.value)}
            required
            rows={3}
            value={reason}
          />
          <AdminFormActions>
            <AdminButton
              disabled={!reason.trim()}
              loading={moderate.isPending}
              type="submit"
              variant={removing ? "danger" : "default"}
            >
              {removing ? "Remove from Peated" : "Restore to Peated"}
            </AdminButton>
          </AdminFormActions>
        </AdminForm>
      </AdminSection>
      <AdminSection title="Moderation history">
        {item.history.length ? (
          <DefinitionList>
            {item.history.map((entry) => (
              <HistoryEntry entry={entry} key={entry.id} />
            ))}
          </DefinitionList>
        ) : (
          <AdminEmptyActivity>No moderation changes yet.</AdminEmptyActivity>
        )}
      </AdminSection>
    </AdminPage>
  );
}

function ContentFields({ item }: { item: ContentItem }) {
  const rows: Array<[string, ReactNode]> = [
    ["ID", item.id],
    [
      "Bottle",
      item.bottle ? (
        <TextLink href={getBottleUrlFromFullName(item.bottle)} key="bottle">
          {item.bottle.fullName}
        </TextLink>
      ) : (
        "No bottle"
      ),
    ],
  ];

  if (item.kind === "external_review") {
    rows.push(
      ["Source", item.site.name],
      ["Reviewer", item.reviewerName ?? "Unknown"],
      ["Score", item.nativeScoreDisplay ?? "None"],
      ["Review clip", item.clip ?? "None"],
      ["Extracted tags", item.tags.length ? item.tags.join(", ") : "None"],
      [
        "Original review",
        <TextLink href={item.article.url} key="article">
          {item.article.title ?? item.article.url}
        </TextLink>,
      ],
      [
        "Published",
        item.article.publishedAt ? (
          <Timestamp
            date={item.article.publishedAt}
            format="date"
            key="published"
          />
        ) : (
          "Unknown"
        ),
      ],
      ["Publication", item.publicationApproved ? "Approved" : "Not approved"],
      ["Source setting", item.hidden ? "Hidden" : "Visible"],
    );
  } else {
    rows.push(
      [
        "Member",
        <TextLink href={`/users/${item.member.username}`} key="member">
          @{item.member.username}
        </TextLink>,
      ],
      ["Member account", item.member.private ? "Private" : "Public"],
      ["Notes", item.notes ?? "None"],
      ["Serving style", item.servingStyle ?? "None"],
      ["Tags", item.tags.length ? item.tags.join(", ") : "None"],
    );
    if (item.kind === "member_review") {
      rows.push(
        ["Score", item.score],
        ["Nose tags", item.noseTags.length ? item.noseTags.join(", ") : "None"],
        [
          "Palate tags",
          item.palateTags.length ? item.palateTags.join(", ") : "None",
        ],
        [
          "Finish tags",
          item.finishTags.length ? item.finishTags.join(", ") : "None",
        ],
      );
    } else {
      rows.push(
        [
          "Rating",
          item.ratingBand ? getRatingBandById(item.ratingBand).label : "None",
        ],
        ["Comments", item.comments],
        ["Toasts", item.toasts],
      );
    }
    if (item.imageUrl) {
      rows.push([
        "Image",
        <TextLink href={item.imageUrl} key="image">
          View image
        </TextLink>,
      ]);
    }
  }

  rows.push([
    "Created",
    <Timestamp date={item.createdAt} format="dateTime" key="created" />,
  ]);
  if ("updatedAt" in item) {
    rows.push([
      "Updated",
      <Timestamp date={item.updatedAt} format="dateTime" key="updated" />,
    ]);
  }

  if (item.moderation.removed) {
    rows.push(
      ["Removed by", item.moderation.removedBy?.displayName ?? "Unknown"],
      ["Removal reason", item.moderation.reason ?? "Unknown"],
      [
        "Removed",
        item.moderation.removedAt ? (
          <Timestamp
            date={item.moderation.removedAt}
            format="dateTime"
            key="removed"
          />
        ) : (
          "Unknown"
        ),
      ],
    );
  }

  return (
    <DefinitionList>
      {rows.map(([term, value]) => (
        <DefinitionRow key={term} term={term} value={value} />
      ))}
    </DefinitionList>
  );
}

function DefinitionRow({ term, value }: { term: string; value: ReactNode }) {
  return (
    <>
      <DefinitionList.Term>{term}</DefinitionList.Term>
      <DefinitionList.Details>{value}</DefinitionList.Details>
    </>
  );
}

function HistoryEntry({ entry }: { entry: ContentItem["history"][number] }) {
  return (
    <>
      <DefinitionList.Term>
        {entry.action === "remove" ? "Removed" : "Restored"}
      </DefinitionList.Term>
      <DefinitionList.Details>
        {entry.reason} — {entry.actor.displayName},{" "}
        <Timestamp date={entry.createdAt} format="dateTime" />
      </DefinitionList.Details>
    </>
  );
}

function reviewListHref(kind: ContentKind) {
  return kind === "external_review"
    ? "/admin/reviews/critics"
    : "/admin/reviews";
}

function contentTitle(item: ContentItem) {
  if (item.kind === "external_review") return item.name;
  return item.bottle.fullName;
}
