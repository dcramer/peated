import Button from "@peated/web/components/button";
import CountryMapIcon from "@peated/web/components/countryMapIcon";
import Heading from "@peated/web/components/heading";
import Markdown from "@peated/web/components/markdown";
import PageHeader from "@peated/web/components/pageHeader";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import { getCurrentUser } from "@peated/web/lib/auth.server";
import { getTrpcClient } from "@peated/web/lib/trpc/client.server";
import { type ReactNode } from "react";

export async function generateMetadata({
  params: { countrySlug, regionSlug },
}: {
  params: { countrySlug: string; regionSlug: string };
}) {
  const trpcClient = await getTrpcClient();
  const region = await trpcClient.regionBySlug.fetch({
    country: countrySlug,
    slug: regionSlug,
  });

  return {
    title: `Whisky from ${region.name}, ${region.country.name}`,
    description: region.description,
  };
}

export default async function Page({
  params: { countrySlug, regionSlug },
  children,
}: {
  params: { countrySlug: string; regionSlug: string };
  children: ReactNode;
}) {
  const trpcClient = await getTrpcClient();
  const region = await trpcClient.regionBySlug.fetch({
    country: countrySlug,
    slug: regionSlug,
  });
  const user = await getCurrentUser();

  const stats = [
    { name: "Distillers", value: region.totalDistillers.toLocaleString() },
    { name: "Bottles", value: region.totalBottles.toLocaleString() },
  ];

  return (
    <>
      <PageHeader
        title={`${region.name}, ${region.country.name}`}
        metadata={
          user?.mod && (
            <Button
              color="primary"
              href={`/admin/locations/${countrySlug}/regions/${regionSlug}/edit`}
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

      {region.description && (
        <>
          <Heading as="h3">
            Whisky in {region.name}, {region.country.name}
          </Heading>
          <div className="flex">
            <div className="prose prose-invert -mt-1 max-w-none flex-auto">
              <Markdown content={region.description} />
            </div>
            <CountryMapIcon
              slug={region.country.slug}
              className="text-light ml-8 hidden max-h-64 max-w-64 lg:block"
            />
          </div>
        </>
      )}

      <Tabs border>
        <TabItem active>Distilleries</TabItem>
      </Tabs>

      {children}
    </>
  );
}
