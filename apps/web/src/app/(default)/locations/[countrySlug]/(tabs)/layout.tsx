import Button from "@peated/web/components/button";
import CountryMapIcon from "@peated/web/components/countryMapIcon";
import Heading from "@peated/web/components/heading";
import Link from "@peated/web/components/link";
import Markdown from "@peated/web/components/markdown";
import PageHeader from "@peated/web/components/pageHeader";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import { getCurrentUser } from "@peated/web/lib/auth.server";
import { getTrpcClient } from "@peated/web/lib/trpc/client.server";
import { type ReactNode } from "react";

export async function generateMetadata({
  params: { countrySlug },
}: {
  params: { countrySlug: string };
}) {
  const trpcClient = await getTrpcClient();
  const country = await trpcClient.countryBySlug.fetch(countrySlug);

  return {
    title: `Whisky from ${country.name}`,
    description: country.description,
  };
}

export default async function Page({
  params: { countrySlug },
  children,
}: {
  params: { countrySlug: string };
  children: ReactNode;
}) {
  const trpcClient = await getTrpcClient();
  const country = await trpcClient.countryBySlug.fetch(countrySlug);
  const user = await getCurrentUser();

  const stats = [
    { name: "Distillers", value: country.totalDistillers.toLocaleString() },
    { name: "Bottles", value: country.totalBottles.toLocaleString() },
  ];

  return (
    <>
      <PageHeader
        title={country.name}
        metadata={
          user?.mod && (
            <Button
              color="primary"
              href={`/admin/locations/${country.slug}/edit`}
            >
              Edit Location
            </Button>
          )
        }
      />

      <div className="my-6 grid grid-cols-3 items-center gap-3 text-center lg:grid-cols-4 lg:text-left">
        {stats.map((stat) => (
          <div key={stat.name}>
            <div className="text-light leading-7">{stat.name}</div>
            <div className="order-first text-3xl font-semibold tracking-tight lg:text-5xl">
              {stat.value || "-"}
            </div>
          </div>
        ))}
      </div>

      {country.description && (
        <>
          <Heading as="h3">Whisky in {country.name}</Heading>
          <div className="flex">
            <div className="prose prose-invert -mt-1 max-w-none flex-auto">
              <Markdown content={country.description} />
            </div>
            <CountryMapIcon
              slug={country.slug}
              className="text-light ml-8 hidden max-h-64 max-w-64 lg:block"
            />
          </div>
        </>
      )}

      <Tabs border>
        <TabItem as={Link} href={`/locations/${countrySlug}`} controlled>
          Distilleries
        </TabItem>
        <TabItem
          as={Link}
          href={`/locations/${countrySlug}/regions`}
          controlled
        >
          Regions
        </TabItem>
      </Tabs>

      {children}
    </>
  );
}
