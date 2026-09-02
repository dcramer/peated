import { buildEventCalendar } from "@peated/web/lib/eventsCalendar";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  props: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await props.params;
  const id = Number(eventId);
  if (!Number.isInteger(id) || id < 1) {
    return new Response(null, { status: 404 });
  }

  const { client } = await getAnonymousServerClient();
  const event = await resolveOrNotFound(client.events.details({ event: id }));

  return new Response(buildEventCalendar(event), {
    headers: {
      "Cache-Control":
        "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      "Content-Disposition": `attachment; filename="peated-event-${event.id}.ics"`,
      "Content-Type": "text/calendar; charset=utf-8",
    },
  });
}
