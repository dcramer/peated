"use client";

import EventForm from "@peated/web/components/admin/eventForm";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const orpc = useORPC();
  const eventCreateMutation = useMutation(orpc.events.create.mutationOptions());

  return (
    <EventForm
      onSubmit={async (data) => {
        const event = await eventCreateMutation.mutateAsync({
          ...data,
        });
        router.push(`/admin/events/${event.id}`);
      }}
    />
  );
}
