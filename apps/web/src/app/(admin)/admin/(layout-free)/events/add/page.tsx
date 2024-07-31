"use client";

import EventForm from "@peated/web/components/admin/eventForm";
import { trpc } from "@peated/web/lib/trpc/client";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const eventCreateMutation = trpc.eventCreate.useMutation();

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
