import { client } from "@peated/web/lib/orpc/client";

export { default } from "@peated/web/components/defaultLayout";

export async function generateMetadata({
  params: { countrySlug },
}: {
  params: { countrySlug: string };
}) {
  const country = await client.countries.details({
    country: countrySlug,
  });

  return {
    title: `Whisky Regions in ${country.name}`,
  };
}
