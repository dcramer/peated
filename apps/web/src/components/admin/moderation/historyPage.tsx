"use client";

import type { Inputs, Outputs } from "@peated/server/orpc/router";
import {
  AdminActions,
  AdminCodeBlock,
  AdminDetails,
  AdminPageHeader,
  AdminSection,
  AdminSplitView,
  AdminStat,
  AdminStatGrid,
  AdminStatus,
} from "@peated/web/components/admin/adminContent.stylex";
import {
  AdminFormGrid,
  AdminSelectField,
  AdminTextField,
} from "@peated/web/components/admin/adminForm.stylex";
import AdminTable from "@peated/web/components/admin/adminTable.stylex";
import Button from "@peated/web/components/button";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

import {
  ModerationDetailContent,
  ModerationDetailFrame,
  ModerationEmpty,
  ModerationLoading,
  ModerationStack,
} from "./moderationDetail.stylex";
import ModerationNav from "./moderationNav";

type Event = Outputs["admin"]["moderation"]["listHistory"]["results"][number];

const recordedFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function eventHref(event: Event, searchParams: URLSearchParams) {
  const [kind, id] = event.key.split(":");
  const query = searchParams.toString();
  return `/admin/moderation/history/${kind}/${id}${query ? `?${query}` : ""}`;
}

function HistoryDetails({ eventKey }: { eventKey: string }) {
  const orpc = useORPC();
  const details = useQuery(
    orpc.admin.moderation.historyDetails.queryOptions({
      input: { key: eventKey },
    }),
  );
  if (details.isPending)
    return <ModerationLoading>Loading decision history…</ModerationLoading>;
  if (details.isError || !details.data) {
    return (
      <ModerationEmpty title="Historical context is unavailable">
        The durable event could not be loaded. No context has been inferred.
      </ModerationEmpty>
    );
  }
  const { event, activity } = details.data;
  return (
    <ModerationDetailContent>
      <ModerationStack>
        <AdminPageHeader
          title={event.title}
          eyebrow={`${event.category} · ${event.kind.replaceAll("_", " ")}`}
        />
        <AdminStatGrid>
          <AdminStat
            label="Outcome"
            value={<AdminStatus>{event.outcome}</AdminStatus>}
          />
          <AdminStat label="Actor" value={event.actor ?? "Unavailable"} />
          <AdminStat
            label="Recorded"
            value={recordedFormatter.format(new Date(event.occurredAt))}
          />
        </AdminStatGrid>
        {details.data.rationale ? (
          <AdminSection title="Rationale">
            {details.data.rationale}
          </AdminSection>
        ) : null}
        {details.data.note ? (
          <AdminSection title="Moderator note">
            {details.data.note}
          </AdminSection>
        ) : null}
        <AdminSection title="Activity">
          <AdminTable
            items={activity}
            primaryKey={(item) => `${item.label}:${item.occurredAt}`}
            columns={[
              { name: "event", value: (item) => item.label },
              {
                name: "recorded",
                value: (item) =>
                  recordedFormatter.format(new Date(item.occurredAt)),
              },
            ]}
          />
        </AdminSection>
        <AdminActions>
          {details.data.sourceUrl ? (
            <Button href={details.data.sourceUrl}>Open source</Button>
          ) : null}
          {details.data.resourceUrl ? (
            <Button href={details.data.resourceUrl}>
              Open affected resource
            </Button>
          ) : null}
        </AdminActions>
        <AdminDetails summary="Recorded details">
          <AdminCodeBlock>
            {JSON.stringify(details.data.details, null, 2)}
          </AdminCodeBlock>
        </AdminDetails>
      </ModerationStack>
    </ModerationDetailContent>
  );
}

export default function HistoryPage({ selectedKey }: { selectedKey?: string }) {
  const orpc = useORPC();
  const searchParams = useSearchParams();
  const category = searchParams.get("category");
  const query = searchParams.get("query");
  const actor = searchParams.get("actor");
  const outcome = searchParams.get("outcome");
  const input: NonNullable<Inputs["admin"]["moderation"]["listHistory"]> = {
    limit: 100,
  };
  if (query) input.query = query;
  if (category === "listing" || category === "catalog")
    input.category = category;
  if (actor) input.actor = actor;
  if (outcome) input.outcome = outcome;
  const { data } = useSuspenseQuery(
    orpc.admin.moderation.listHistory.queryOptions({ input }),
  );

  const list = (
    <AdminSection title="History">
      <form action="/admin/moderation/history">
        <AdminFormGrid>
          <AdminTextField
            defaultValue={query ?? ""}
            label="Search"
            name="query"
            placeholder="Search outcomes"
          />
          <AdminSelectField
            defaultValue={category ?? ""}
            label="Work"
            name="category"
            options={[
              { value: "", label: "All work" },
              { value: "listing", label: "Listings" },
              { value: "catalog", label: "Catalog" },
            ]}
          />
          <AdminTextField
            defaultValue={actor ?? ""}
            label="Actor"
            name="actor"
          />
          <AdminTextField
            defaultValue={outcome ?? ""}
            label="Outcome"
            name="outcome"
          />
          <Button type="submit">Apply filters</Button>
        </AdminFormGrid>
      </form>
      {data.results.length ? (
        <AdminTable
          items={data.results}
          primaryKey={(event) => event.key}
          url={(event) => eventHref(event, searchParams)}
          columns={[
            { name: "decision", value: (event) => event.title },
            {
              name: "outcome",
              value: (event) => <AdminStatus>{event.outcome}</AdminStatus>,
            },
            { name: "actor", value: (event) => event.actor ?? "Unavailable" },
          ]}
        />
      ) : (
        "No completed decisions match these filters."
      )}
    </AdminSection>
  );

  return (
    <>
      <ModerationNav />
      <AdminSplitView
        list={list}
        selected={Boolean(selectedKey)}
        detail={
          <ModerationDetailFrame>
            {selectedKey ? (
              <HistoryDetails eventKey={selectedKey} />
            ) : (
              <ModerationEmpty title="Choose a completed decision">
                History is read-only and comes from the original durable
                records.
              </ModerationEmpty>
            )}
          </ModerationDetailFrame>
        }
      />
    </>
  );
}
