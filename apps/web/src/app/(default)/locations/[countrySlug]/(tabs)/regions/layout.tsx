import { getTrpcClient } from "@peated/web/lib/trpc.server";

export { default } from "@peated/web/components/defaultLayout";

export async function generateMetadata({
  params: { countrySlug },
}: {
  params: { countrySlug: string };
}) {
  const trpcClient = await getTrpcClient();
  const country = await trpcClient.countryBySlug.fetch(countrySlug);

  return {
    title: `Whisky Regions in ${country.name}`,
  };
}
