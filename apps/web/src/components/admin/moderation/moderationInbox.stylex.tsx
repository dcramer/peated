"use client";

import type { Outputs } from "@peated/server/orpc/router";
import ConfirmationDialog from "@peated/web/components/confirmationDialog.client";
import TimeSince from "@peated/web/components/timeSince";
import { buildQueryString } from "@peated/web/lib/urls";
import * as stylex from "@stylexjs/stylex";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { AppLink } from "@peated/web/components/appLink";
import { Button } from "@peated/web/components/button.stylex";
import {
  LoadingList,
  LoadingPlaceholder,
} from "@peated/web/components/feedback.stylex";
import { TextInput } from "@peated/web/components/field.stylex";
import { CursorPager } from "@peated/web/components/lists.stylex";
import { foundationStyles } from "../../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  space,
} from "../../../styles/tokens.stylex";
import { LinkPending } from "../../linkPending.stylex";

type Task = Outputs["admin"]["moderation"]["listTasks"]["results"][number];

type InboxListProps = {
  bulkError?: string | null;
  data: Outputs["admin"]["moderation"]["listTasks"];
  ignoreInconclusivePending?: boolean;
  onIgnoreInconclusive?: () => Promise<void>;
  selectedKey?: string;
};

export function inboxTaskHref(
  task: Task,
  searchParams: URLSearchParams,
): string {
  const query = searchParams.toString();
  const id =
    task.source.kind === "listing"
      ? task.source.proposalId
      : task.source.kind === "operation"
        ? task.source.operationId
        : task.source.checkId;
  const href = `/admin/moderation/inbox/${task.kind}/${id}`;
  return query ? `${href}?${query}` : href;
}

export default function ModerationInbox(props: InboxListProps) {
  return (
    <ModerationInboxContent
      {...props}
      pathname={usePathname()}
      searchParams={useSearchParams()}
    />
  );
}

/** Keeps the inbox controls and row density stable while work loads. */
export function ModerationInboxLoading({
  title = "Inbox",
}: {
  title?: string;
}) {
  return (
    <section
      aria-busy="true"
      aria-label={`Loading ${title.toLowerCase()}`}
      role="status"
      {...stylex.props(styles.root)}
    >
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.titleRow)}>
          <h1
            {...stylex.props(foundationStyles.pageTitleCompact, styles.title)}
          >
            {title}
          </h1>
          <LoadingPlaceholder preset="metadata" />
        </div>
        <div aria-hidden="true" {...stylex.props(styles.loadingSearch)} />
        <div aria-hidden="true" {...stylex.props(styles.loadingFilters)}>
          {Array.from({ length: 4 }, (_, index) => (
            <LoadingPlaceholder
              delay={loadingDelays[index]}
              key={index}
              preset="metadata"
            />
          ))}
        </div>
      </header>
      <div {...stylex.props(styles.loadingTasks)}>
        <LoadingList
          label={`Loading ${title.toLowerCase()} records`}
          rows={6}
          variant="text"
        />
      </div>
    </section>
  );
}

const loadingDelays = [0, 1, 2, 3] as const;

export function ModerationInboxContent({
  bulkError,
  data,
  ignoreInconclusivePending = false,
  onIgnoreInconclusive,
  pathname,
  searchParams,
  selectedKey,
}: InboxListProps & { pathname: string; searchParams: URLSearchParams }) {
  const category = searchParams.get("category");
  const blocked = searchParams.get("blocked") === "true";
  const inconclusive = searchParams.get("inconclusive") === "true";
  const query = searchParams.get("query") ?? "";
  const page = Number(searchParams.get("cursor") ?? 1);
  const [confirmingIgnore, setConfirmingIgnore] = useState(false);
  const listPath = pathname.includes("/inbox/")
    ? "/admin/moderation/inbox"
    : pathname;
  const filterHref = (next: Record<string, string | null>) => {
    const value = buildQueryString(searchParams, { ...next, cursor: null });
    return value ? `${listPath}?${value}` : listPath;
  };
  const filters = [
    {
      label: `All ${data.counts.all}`,
      active: !category && !blocked && !inconclusive,
      href: filterHref({ category: null, blocked: null, inconclusive: null }),
    },
    {
      label: `Listings ${data.counts.listing}`,
      active: category === "listing",
      href: filterHref({ category: "listing", inconclusive: null }),
    },
    {
      label: `Catalog ${data.counts.catalog}`,
      active: category === "catalog",
      href: filterHref({ category: "catalog", inconclusive: null }),
    },
    {
      label: `Inconclusive ${data.counts.inconclusive}`,
      active: inconclusive,
      href: filterHref({
        inconclusive: inconclusive ? null : "true",
        category: null,
        blocked: null,
      }),
    },
    {
      label: `Blocked ${data.counts.blocked}`,
      active: blocked,
      href: filterHref({
        blocked: blocked ? null : "true",
        inconclusive: null,
      }),
    },
  ];

  return (
    <section aria-label="Moderation inbox" {...stylex.props(styles.root)}>
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.titleRow)}>
          <h1
            {...stylex.props(foundationStyles.pageTitleCompact, styles.title)}
          >
            Inbox
          </h1>
          <span {...stylex.props(foundationStyles.metadata, styles.count)}>
            {data.counts.all} open
          </span>
        </div>
        <form action={listPath} {...stylex.props(styles.searchForm)}>
          {category ? (
            <input name="category" type="hidden" value={category} />
          ) : null}
          {blocked ? <input name="blocked" type="hidden" value="true" /> : null}
          {inconclusive ? (
            <input name="inconclusive" type="hidden" value="true" />
          ) : null}
          <label htmlFor="moderation-search" {...stylex.props(styles.srOnly)}>
            Search inbox
          </label>
          <TextInput
            controlSize="md"
            defaultValue={query}
            id="moderation-search"
            name="query"
            placeholder="Search decisions"
            type="search"
          />
        </form>
        <nav aria-label="Inbox filters" {...stylex.props(styles.filters)}>
          {filters.map((filter) => (
            <AppLink
              aria-current={filter.active ? "page" : undefined}
              href={filter.href}
              prefetch={null}
              key={filter.label}
              {...stylex.props(
                foundationStyles.interactiveSmall,
                styles.filter,
                filter.active && styles.activeFilter,
              )}
            >
              {filter.label}
              <LinkPending />
            </AppLink>
          ))}
        </nav>
        {inconclusive && data.counts.inconclusive > 0 ? (
          <div {...stylex.props(styles.bulkAction)}>
            <Button
              disabled={ignoreInconclusivePending}
              fullWidth
              loading={ignoreInconclusivePending}
              onClick={() => setConfirmingIgnore(true)}
              variant="danger"
            >
              Ignore all {data.counts.inconclusive} inconclusive
            </Button>
            <p {...stylex.props(foundationStyles.metadata, styles.help)}>
              These listings have no recommended bottle. Ignoring them removes
              them from the inbox without assigning one.
            </p>
          </div>
        ) : null}
        {bulkError ? (
          <p
            role="alert"
            {...stylex.props(foundationStyles.metadata, styles.error)}
          >
            {bulkError}
          </p>
        ) : null}
      </header>
      <ConfirmationDialog
        continueLabel={`Ignore ${data.counts.inconclusive} listings`}
        isOpen={confirmingIgnore}
        message="Every actionable inconclusive listing will leave the moderation inbox without a bottle assignment. Listings with a match, proposed bottle, correction, error, or active classification will not be changed."
        onCancel={() => setConfirmingIgnore(false)}
        onContinue={() => {
          setConfirmingIgnore(false);
          void onIgnoreInconclusive?.();
        }}
        title="Ignore all inconclusive listings?"
      />
      {data.results.length ? (
        <ol {...stylex.props(styles.taskList)}>
          {data.results.map((task) => {
            const selected = task.key === selectedKey;
            return (
              <li key={task.key} {...stylex.props(styles.taskItem)}>
                <AppLink
                  aria-current={selected ? "true" : undefined}
                  href={inboxTaskHref(task, searchParams)}
                  {...stylex.props(
                    styles.taskLink,
                    selected && styles.selectedTask,
                  )}
                >
                  <span
                    {...stylex.props(
                      foundationStyles.metadata,
                      styles.taskMeta,
                    )}
                  >
                    <span>{task.category}</span>
                    <TimeSince date={task.attentionAt} />
                  </span>
                  <strong
                    title={task.title}
                    {...stylex.props(
                      foundationStyles.compactRowTitle,
                      styles.taskTitle,
                    )}
                  >
                    {task.title}
                  </strong>
                  <span
                    title={task.question}
                    {...stylex.props(
                      foundationStyles.metadata,
                      styles.question,
                    )}
                  >
                    {task.question}
                  </span>
                  <span
                    {...stylex.props(
                      foundationStyles.metadata,
                      styles.taskMeta,
                    )}
                  >
                    <span
                      title={task.sourceLabel}
                      {...stylex.props(styles.truncate)}
                    >
                      {task.sourceLabel}
                    </span>
                    <span
                      {...stylex.props(
                        task.state === "blocked" && styles.blocked,
                      )}
                    >
                      {task.statusLabel}
                    </span>
                  </span>
                  <LinkPending />
                </AppLink>
              </li>
            );
          })}
        </ol>
      ) : (
        <div {...stylex.props(foundationStyles.metadata, styles.empty)}>
          <strong>Nothing needs a decision</strong>
          <span>
            Clear the filters or check background work for problems and retries.
          </span>
        </div>
      )}
      {data.rel.prevCursor || data.rel.nextCursor ? (
        <div {...stylex.props(styles.pager)}>
          <CursorPager
            ariaLabel="Inbox pages"
            nextHref={
              data.rel.nextCursor
                ? `${listPath}?${buildQueryString(searchParams, {
                    cursor: data.rel.nextCursor,
                  })}`
                : undefined
            }
            page={page}
            previousHref={
              data.rel.prevCursor
                ? `${listPath}?${buildQueryString(searchParams, {
                    cursor: data.rel.prevCursor,
                  })}`
                : undefined
            }
          />
        </div>
      ) : null}
    </section>
  );
}

const styles = stylex.create({
  root: {
    display: "flex",
    minWidth: 0,
    minHeight: 0,
    flexDirection: "column",
    backgroundColor: "transparent",
  },
  header: {
    padding: space.x4,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  titleRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x3,
  },
  title: {
    margin: 0,
    color: colors.ink,
  },
  count: { color: colors.inkMuted },
  searchForm: { marginTop: space.x4 },
  loadingSearch: {
    width: "100%",
    height: controlMetrics.controlHeight,
    marginTop: space.x4,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.inset,
  },
  loadingFilters: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: space.x2,
    marginTop: space.x3,
  },
  loadingTasks: { paddingRight: space.x4, paddingLeft: space.x4 },
  srOnly: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
  },
  filters: {
    display: "flex",
    gap: space.x2,
    marginTop: space.x3,
    flexWrap: "wrap",
  },
  filter: {
    position: "relative",
    display: "inline-flex",
    minHeight: "32px",
    alignItems: "center",
    paddingRight: space.x3,
    paddingLeft: space.x3,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    color: { default: colors.inkMuted, ":hover": colors.ink },
    fontWeight: 600,
    textDecoration: "none",
    boxShadow: { default: "none", ":focus-visible": effects.focusRing },
  },
  activeFilter: {
    borderColor: colors.accent,
    backgroundColor: colors.accentTint,
    color: colors.accentDeep,
  },
  bulkAction: { display: "grid", gap: space.x2, marginTop: space.x4 },
  help: {
    margin: 0,
    color: colors.inkMuted,
  },
  error: {
    margin: 0,
    marginTop: space.x3,
    color: colors.accentDeep,
  },
  taskList: {
    minHeight: 0,
    margin: 0,
    padding: 0,
    overflowY: "auto",
    listStyle: "none",
  },
  pager: {
    paddingRight: space.x4,
    paddingBottom: space.x4,
    paddingLeft: space.x4,
  },
  taskItem: {
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  taskLink: {
    position: "relative",
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x2,
    padding: space.x4,
    borderWidth: 0,
    outline: "none",
    backgroundColor: { default: "transparent", ":hover": colors.inset },
    color: colors.ink,
    textDecoration: "none",
    boxShadow: { default: "none", ":focus-visible": effects.focusRing },
  },
  selectedTask: {
    backgroundColor: colors.accentTint,
  },
  taskMeta: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x3,
    color: colors.inkMuted,
    whiteSpace: "nowrap",
  },
  taskTitle: {
    color: colors.ink,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  question: {
    display: "-webkit-box",
    color: colors.inkMuted,
    overflow: "hidden",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
  },
  truncate: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" },
  blocked: { color: colors.accentDeep },
  empty: {
    display: "flex",
    minHeight: "120px",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: space.x2,
    padding: space.x6,
    color: colors.inkMuted,
    textAlign: "center",
  },
});
