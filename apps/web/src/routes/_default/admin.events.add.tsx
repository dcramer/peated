import EventForm from "@peated/web/components/admin/eventForm";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_default/admin/events/add")({
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const orpc = useORPC();
  const eventCreateMutation = useMutation(orpc.events.create.mutationOptions());

  return (
    <EventForm
      onSubmit={async (data) => {
        const event = await eventCreateMutation.mutateAsync({
          ...data,
        });
        navigate({ to: `/admin/events/${event.id}` });
      }}
    />
  );
}
