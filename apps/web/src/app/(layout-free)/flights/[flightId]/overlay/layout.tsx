import { summarize } from "@peated/web/lib/markdown";
import { getServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
export { default } from "@peated/web/components/defaultLayout";

export async function generateMetadata(props: {
  params: Promise<{ flightId: string }>;
}) {
  const params = await props.params;

  const { flightId } = params;

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
    alternates: { canonical: `https://peated.com/flights/${flightId}` },
  };
}
