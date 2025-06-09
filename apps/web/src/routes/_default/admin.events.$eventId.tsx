import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import DateRange from "@peated/web/components/dateRange";
import DefinitionList from "@peated/web/components/definitionList";
import Heading from "@peated/web/components/heading";
import Markdown from "@peated/web/components/markdown";
import PageHeader from "@peated/web/components/pageHeader";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_default/admin/events/$eventId")({
  component: Page,
});

function Page() {
  const { eventId } = Route.useParams();
  const orpc = useORPC();
  const { data: event } = useSuspenseQuery(
    orpc.events.details.queryOptions({
      input: {
        event: Number.parseInt(eventId, 10),
      },
    })
  );

  return (
    <div className="w-full p-3 lg:py-0">
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            to: "/admin",
          },
          {
            name: "Events",
            to: "/admin/events",
          },
          {
            name: event.name,
            to: `/admin/events/${event.id}`,
            current: true,
          },
        ]}
      />

      <PageHeader
        title={event.name}
        metadata={
          <Button asChild>
            <Link
              to="/admin/events/$eventId/edit"
              params={{ eventId: event.id }}
            >
              Edit Event
            </Link>
          </Button>
        }
      />

      <Tabs border>
        <TabItem asChild controlled>
          <Link to="/admin/events/$eventId" params={{ eventId: event.id }}>
            Overview
          </Link>
        </TabItem>
      </Tabs>

      {event.description && (
        <>
          <Heading asChild>
            <h3>Description</h3>
          </Heading>
          <div className="prose prose-invert -mt-1 max-w-none flex-auto">
            <Markdown content={event.description} />
          </div>
        </>
      )}

      <Heading asChild>
        <h3>Additional Information</h3>
      </Heading>

      <DefinitionList>
        <DefinitionList.Term>Dates</DefinitionList.Term>
        <DefinitionList.Details>
          <DateRange start={event.dateStart} end={event.dateEnd} />
          {event.repeats && "(repeats annually)"}
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
