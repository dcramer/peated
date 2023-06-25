import type { V2_MetaFunction } from "@remix-run/node";
import { useQuery } from "@tanstack/react-query";
import Layout from "~/components/layout";
import config from "~/config";
import useApi from "~/hooks/useApi";

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: "About",
    },
  ];
};

export default function About() {
  return (
    <Layout>
      <div className="flex gap-4 px-2 sm:px-0">
        <div className="prose py-6">
          <h1>The Mission</h1>
          <p>
            Peated, inspired by apps like Untapped and Vivino, aims to create a
            rich social experience around tasting and collecting Whiskey. We
            leverage modern and open source technology to go beyond the typical
            experiences you see elsewhere.
          </p>
          <p>
            Core to our goals is a spirit database heavily focused on
            reliability and quality of data. This database has been bootstrapped
            by collating various sources of data, and is curated by the
            community. Most importantly, its available via a modern web API, the
            same API which powers the application experiences.
          </p>
          <p>
            Peated was started by{" "}
            <a href="https://twitter.com/zeeg">David Cramer</a> and is{" "}
            <a href={config.GITHUB_REPO}>Open Source on GitHub</a>. A{" "}
            <a href={config.DISCORD_LINK}>Discord server</a> is available if you
            want to contribute.
          </p>
        </div>
        <div className="hidden flex-1 sm:block">
          <div className="prose py-6 text-center">
            <h1>Key Data</h1>
          </div>
          <Stats />
        </div>
      </div>
    </Layout>
  );
}

const Stats = () => {
  const api = useApi();
  const { data } = useQuery(
    ["stats"],
    (): Promise<Record<string, number>> => api.get(`/stats`),
  );

  if (!data) return null;

  const stats = [
    { name: "Tastings", value: data.totalTastings.toLocaleString() },
    { name: "Bottles", value: data.totalBottles.toLocaleString() },
    { name: "Entities", value: data.totalEntities.toLocaleString() },
  ];

  return (
    <div className="hidden items-center gap-4 text-center sm:grid sm:grid-cols-1 lg:grid-cols-2">
      {stats.map((stat) => (
        <div key={stat.name}>
          <p className="text-peated-light leading-7">{stat.name}</p>
          <p className="order-first text-3xl font-semibold tracking-tight sm:text-5xl">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
};
