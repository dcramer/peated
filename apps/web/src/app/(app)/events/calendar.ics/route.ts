import { buildEventsCalendar } from "@peated/web/lib/eventsCalendar";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";

export const revalidate = 3600;

export async function GET() {
  const { client } = await getAnonymousServerClient();
  const eventList = await client.events.list({
    limit: 100,
    onlyUpcoming: true,
    sort: "date",
  });

  return new Response(buildEventsCalendar(eventList.results), {
    headers: {
      "Cache-Control":
        "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      "Content-Disposition": 'attachment; filename="peated-whisky-events.ics"',
      "Content-Type": "text/calendar; charset=utf-8",
    },
  });
}
