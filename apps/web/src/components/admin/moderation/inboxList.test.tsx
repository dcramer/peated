import type { Outputs } from "@peated/server/orpc/router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { InboxListContent, inboxTaskHref } from "./inboxList";

type Task = Outputs["admin"]["moderation"]["listTasks"]["results"][number];

const operationTask = {
  key: "operation:22",
  kind: "operation",
  category: "catalog",
  state: "ready",
  inconclusive: false,
  title: "Update Entity #42",
  sourceLabel: "Moderator audit",
  question: "Apply these changes to the Entity?",
  statusLabel: "Suggested change",
  attentionAt: "2026-08-12T10:00:00.000Z",
  source: { kind: "operation", checkId: 9, operationId: 22 },
} satisfies Task;

const listingTask = {
  key: "listing:7",
  kind: "listing",
  category: "listing",
  state: "blocked",
  inconclusive: false,
  title: "Mystery whisky listing",
  sourceLabel: "Example Store",
  question: "How should this listing be resolved?",
  statusLabel: "Needs recovery",
  attentionAt: "2026-08-12T09:00:00.000Z",
  source: { kind: "listing", proposalId: 7 },
} satisfies Task;

describe("Moderation Inbox list", () => {
  test("renders compact task questions, counts, and selected state", () => {
    const html = renderToStaticMarkup(
      <InboxListContent
        data={{
          results: [listingTask, operationTask],
          counts: {
            all: 2,
            listing: 1,
            catalog: 1,
            blocked: 1,
            inconclusive: 0,
          },
          rel: { nextCursor: null, prevCursor: null },
        }}
        pathname="/admin/moderation/inbox/operation/22"
        searchParams={new URLSearchParams("category=catalog&query=brand")}
        selectedKey="operation:22"
      />,
    );

    expect(html).toContain("Apply these changes to the Entity?");
    expect(html).toContain("How should this listing be resolved?");
    expect(html).toContain("Listings 1");
    expect(html).toContain("Catalog 1");
    expect(html).toContain('aria-current="true"');
  });

  test("preserves list filters in direct task URLs", () => {
    expect(
      inboxTaskHref(
        operationTask,
        new URLSearchParams("category=catalog&blocked=true"),
      ),
    ).toBe(
      "/admin/moderation/inbox/operation/22?category=catalog&blocked=true",
    );
  });
});
