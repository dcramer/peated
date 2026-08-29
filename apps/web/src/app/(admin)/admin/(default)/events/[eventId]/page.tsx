"use client";

import { use } from "react";

import { AdminButton as Button } from "@peated/web/components/admin/adminButton.stylex";
import {
  AdminBreadcrumbs,
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminTextLink,
} from "@peated/web/components/admin/adminContent.stylex";
import { AdminDefinitionList as DefinitionList } from "@peated/web/components/admin/adminUtility.stylex";
import DateRange from "@peated/web/components/dateRange";
import Markdown from "@peated/web/components/markdown";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const orpc = useORPC();
  const { data: event } = useSuspenseQuery(
    orpc.events.details.queryOptions({
      input: { event: Number.parseInt(eventId, 10) },
    }),
  );

  return (
    <AdminPage>
      <AdminBreadcrumbs
        items={[
          { label: "Events", href: "/admin/events" },
          {
            label: event.name,
            href: `/admin/events/${event.id}`,
            current: true,
          },
        ]}
      />
      <AdminPageHeader
        title={event.name}
        actions={
          <Button href={`/admin/events/${event.id}/edit`}>Edit event</Button>
        }
      />
      {event.description ? (
        <AdminSection title="Description">
          <Markdown content={event.description} />
        </AdminSection>
      ) : null}
      <AdminSection title="Details">
        <DefinitionList>
          <DefinitionList.Term>Dates</DefinitionList.Term>
          <DefinitionList.Details>
            <DateRange start={event.dateStart} end={event.dateEnd} />
            {event.repeats ? " · repeats annually" : null}
          </DefinitionList.Details>
          <DefinitionList.Term>Country</DefinitionList.Term>
          <DefinitionList.Details>
            {event.country?.name ?? "Not set"}
          </DefinitionList.Details>
          <DefinitionList.Term>Website</DefinitionList.Term>
          <DefinitionList.Details>
            {event.website ? (
              <AdminTextLink href={event.website}>
                {event.website}
              </AdminTextLink>
            ) : (
              "Not set"
            )}
          </DefinitionList.Details>
        </DefinitionList>
      </AdminSection>
    </AdminPage>
  );
}
