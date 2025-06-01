"use client";

import EventForm from "@peated/web/components/admin/eventForm";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function Page({
  params: { eventId },
}: {
  params: { eventId: string };
}) {
  const orpc = useORPC();
  const { data: event } = useSuspenseQuery(
    orpc.events.details.queryOptions({
      input: {
        event: Number.parseInt(eventId, 10),
      },
    })
  );

  const router = useRouter();
  const eventUpdateMutation = useMutation(orpc.events.update.mutationOptions());

  return (
    <EventForm
      onSubmit={async (data) => {
        const newEvent = await eventUpdateMutation.mutateAsync({
          ...data,
          event: event.id,
        });
        router.push(`/admin/events/${newEvent.id}`);
      }}
      edit
      title="Edit Event"
      initialData={event}
    />
  );
}
