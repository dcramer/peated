"use client";

import EventForm from "@peated/web/components/admin/eventForm";
import { trpc } from "@peated/web/lib/trpc/client";
import { useRouter } from "next/navigation";

export default function Page({
  params: { eventId },
}: {
  params: { eventId: string };
}) {
  const [event] = trpc.eventById.useSuspenseQuery(parseInt(eventId, 10));

  const router = useRouter();
  const eventUpdateMutation = trpc.eventUpdate.useMutation();

  return (
    <EventForm
      onSubmit={async (data) => {
        const newEvent = await eventUpdateMutation.mutateAsync({
          ...data,
          id: event.id,
        });
        router.push(`/admin/events/${newEvent.id}`);
      }}
      edit
      title="Edit Event"
      initialData={event}
    />
  );
}
