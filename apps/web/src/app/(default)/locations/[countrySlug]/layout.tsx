import CountrySpiritDistribution from "@peated/web/components/countrySpiritDistribution";
import PageHeader from "@peated/web/components/pageHeader";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import { getTrpcClient } from "@peated/web/lib/trpc.server";
import { Suspense, type ReactNode } from "react";

export async function generateMetadata({
  params: { countrySlug },
}: {
  params: { countrySlug: string };
}) {
  const trpcClient = await getTrpcClient();
  const country = await trpcClient.countryBySlug.fetch(countrySlug);

  return {
    title: `Whisky from ${country.name}`,
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

  const stats = [
    { name: "Distilleries", value: country.totalDistilleries.toLocaleString() },
    { name: "Bottles", value: country.totalBottles.toLocaleString() },
  ];

  return (
    <>
      <PageHeader title={country.name} />

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

      <div className="my-6 flex flex-col gap-4 px-3 sm:flex-row md:px-0">
        <div className="flex-auto">
          <Suspense
            fallback={
              <div
                className="animate-pulse rounded bg-slate-800"
                style={{ height: 20 }}
              />
            }
          >
            <CountrySpiritDistribution countrySlug={country.slug} />
          </Suspense>
        </div>
      </div>

      <Tabs fullWidth border>
        <TabItem active>Distilleries</TabItem>
      </Tabs>

      {children}
    </>
  );
}
