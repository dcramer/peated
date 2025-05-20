import { getServerClient } from "@peated/web/lib/orpc/client.server";

export { default } from "@peated/web/components/defaultLayout";

export async function generateMetadata({
  params: { countrySlug },
}: {
  params: { countrySlug: string };
}) {
  const client = await getServerClient();
  const country = await client.countries.details({
    country: countrySlug,
  });

  return {
    title: `Whisky Regions in ${country.name}`,
  };
}
