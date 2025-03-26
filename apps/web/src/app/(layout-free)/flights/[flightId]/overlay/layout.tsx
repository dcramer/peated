import { summarize } from "@peated/web/lib/markdown";
import { getTrpcClient } from "@peated/web/lib/trpc/client.server";
export { default } from "@peated/web/components/defaultLayout";

export async function generateMetadata({
  params: { flightId },
}: {
  params: { flightId: string };
}) {
  const trpcClient = await getTrpcClient();
  const flight = await trpcClient.flightById.fetch(flightId);
  const description = summarize(flight.description || "", 200);

  return {
    title: `${flight.name} - Flight Details`,
    description,
    alternates: { canonical: `https://peated.com/flights/${flightId}` },
  };
}
