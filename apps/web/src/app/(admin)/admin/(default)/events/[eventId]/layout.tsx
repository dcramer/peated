"use client";

import { type ExternalSiteSchema } from "@peated/server/schemas";
import { type ExternalSiteType } from "@peated/server/types";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import Link from "@peated/web/components/link";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import TimeSince from "@peated/web/components/timeSince";
import { formatDuration } from "@peated/web/lib/format";
import { trpc } from "@peated/web/lib/trpc/client";
import { useState, type ReactNode } from "react";
import { type z } from "zod";

export default function Layout({
  params: { eventId },
  children,
}: {
  params: { eventId: string };
  children: ReactNode;
}) {
  const [initialEvent] = trpc.eventById.useSuspenseQuery(parseInt(eventId, 10));

  const [event, setEvent] = useState(initialEvent);

  return (
    <div className="w-full p-3 lg:py-0">
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            href: "/admin",
          },
          {
            name: "Events",
            href: "/admin/events",
          },
          {
            name: event.name,
            href: `/admin/events/${event.id}`,
            current: true,
          },
        ]}
      />

      <div className="my-8 flex min-w-full flex-wrap gap-y-4 sm:flex-nowrap">
        <div className="flex w-full flex-col justify-center gap-y-4 px-4 sm:w-auto sm:flex-auto sm:gap-y-2">
          <h3 className="self-center text-4xl font-semibold text-white sm:self-start">
            {event.name}
          </h3>
          <div className="flex justify-center sm:justify-start">
            <div className="mr-4 pr-3 text-center">
              <span className="racking-wide block text-xl  font-bold text-white">
                {event.dateStart}
              </span>
              <span className="text-muted text-sm">When</span>
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col items-center justify-center sm:w-auto sm:items-end">
          <div className="flex gap-x-2">
            <Button href={`/admin/events/${event.id}/edit`}>Edit Event</Button>
          </div>
        </div>
      </div>

      <Tabs border>
        <TabItem as={Link} href={`/admin/events/${event.id}`} controlled>
          Overview
        </TabItem>
      </Tabs>

      {children}
    </div>
  );
}
