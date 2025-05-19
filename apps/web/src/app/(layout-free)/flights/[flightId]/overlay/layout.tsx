import { summarize } from "@peated/web/lib/markdown";
import { client } from "@peated/web/lib/orpc/client";
export { default } from "@peated/web/components/defaultLayout";

export async function generateMetadata({
  params: { flightId },
}: {
  params: { flightId: string };
}) {
  const flight = await client.flights.details({
    flight: flightId,
  });
  const description = summarize(flight.description || "", 200);

  return {
    title: `${flight.name} - Flight Details`,
    description,
    alternates: { canonical: `https://peated.com/flights/${flightId}` },
  };
}
