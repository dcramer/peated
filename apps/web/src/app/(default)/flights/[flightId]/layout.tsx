import { summarize } from "@peated/web/lib/markdown";
import { getServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import type { ReactNode } from "react";

export async function generateMetadata({
  params: { flightId },
}: {
  params: { flightId: string };
}) {
  const { client } = await getServerClient();

  const flight = await resolveOrNotFound(
    client.flights.details({
      flight: flightId,
    }),
  );
  const description = summarize(flight.description || "", 200);

  return {
    title: `${flight.name} - Flight Details`,
    description,
  };
}

export default async function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
