import EventForm from "@peated/web/components/admin/eventForm";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute({
  component: Page,
});

function Page() {
  const { eventId } = Route.useParams();
  const orpc = useORPC();
  const { data: event } = useSuspenseQuery(
    orpc.events.details.queryOptions({
      input: {
        event: parseInt(eventId, 10),
      },
    }),
  );

  const navigate = useNavigate();
  const eventUpdateMutation = useMutation(orpc.events.update.mutationOptions());

  return (
    <EventForm
      onSubmit={async (data) => {
        const newEvent = await eventUpdateMutation.mutateAsync({
          ...data,
          event: event.id,
        });
        navigate({ to: `/admin/events/${newEvent.id}` });
      }}
      edit
      title="Edit Event"
      initialData={event}
    />
  );
}
