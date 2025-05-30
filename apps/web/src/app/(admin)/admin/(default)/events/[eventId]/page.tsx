"use client";

import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import DateRange from "@peated/web/components/dateRange";
import DefinitionList from "@peated/web/components/definitionList";
import Heading from "@peated/web/components/heading";
import Link from "@peated/web/components/link";
import Markdown from "@peated/web/components/markdown";
import PageHeader from "@peated/web/components/pageHeader";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page({
  params: { eventId },
}: {
  params: { eventId: string };
}) {
  const orpc = useORPC();
  const { data: event } = useSuspenseQuery(
    orpc.events.details.queryOptions({
      input: {
        event: parseInt(eventId, 10),
      },
    }),
  );

  return (
    <div className="w-full p-3 lg:py-0">
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            href: "/admin",
          },
          {
            name: "Events",
            href: "/admin/events",
          },
          {
            name: event.name,
            href: `/admin/events/${event.id}`,
            current: true,
          },
        ]}
      />

      <PageHeader
        title={event.name}
        metadata={
          <Button href={`/admin/events/${event.id}/edit`}>Edit Event</Button>
        }
      />

      <Tabs border>
        <TabItem as={Link} href={`/admin/events/${event.id}`} controlled>
          Overview
        </TabItem>
      </Tabs>

      {event.description && (
        <>
          <Heading as="h3">Description</Heading>
          <div className="prose prose-invert -mt-1 max-w-none flex-auto">
            <Markdown content={event.description} />
          </div>
        </>
      )}

      <Heading as="h3">Additional Information</Heading>

      <DefinitionList>
        <DefinitionList.Term>Dates</DefinitionList.Term>
        <DefinitionList.Details>
          <DateRange start={event.dateStart} end={event.dateEnd} />
          {event.repeats && <> (repeats annually)</>}
        </DefinitionList.Details>
        <DefinitionList.Term>Country</DefinitionList.Term>
        <DefinitionList.Details>
          {event.country ? event.country.name : <em>n/a</em>}
        </DefinitionList.Details>
        <DefinitionList.Term>Website</DefinitionList.Term>
        <DefinitionList.Details>
          {event.website ? (
            <a href={event.website}>{event.website}</a>
          ) : (
            <em>n/a</em>
          )}
        </DefinitionList.Details>
      </DefinitionList>
    </div>
  );
}
