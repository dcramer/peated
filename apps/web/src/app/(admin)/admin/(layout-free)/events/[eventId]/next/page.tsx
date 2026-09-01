"use client";

import EventForm from "@peated/web/components/admin/eventForm";
import { getNextEditionDates } from "@peated/web/lib/eventDates";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { use } from "react";

export default function Page({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const router = useRouter();
  const orpc = useORPC();
  const { data: sourceEvent } = useSuspenseQuery(
    orpc.events.details.queryOptions({
      input: { event: Number.parseInt(eventId, 10) },
    }),
  );
  const eventCreateMutation = useMutation(orpc.events.create.mutationOptions());

  return (
    <EventForm
      initialData={{
        ...sourceEvent,
        ...getNextEditionDates(sourceEvent),
      }}
      onSubmit={async (data) => {
        const event = await eventCreateMutation.mutateAsync(data);
        router.push(`/admin/events/${event.id}`);
      }}
      title="Add next edition"
    />
  );
}
