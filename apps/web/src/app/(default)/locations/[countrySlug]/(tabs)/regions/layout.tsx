import { getTrpcClient } from "@peated/web/lib/trpc/client.server";

export { default } from "@peated/web/components/defaultLayout";

export async function generateMetadata(props: {
  params: Promise<{ countrySlug: string }>;
}) {
  const params = await props.params;

  const { countrySlug } = params;

  const trpcClient = await getTrpcClient();
  const country = await trpcClient.countryBySlug.fetch(countrySlug);

  return {
    title: `Whisky Regions in ${country.name}`,
  };
}
