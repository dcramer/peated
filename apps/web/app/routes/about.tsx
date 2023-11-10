import type { MetaFunction } from "@remix-run/node";
import { type SitemapFunction } from "remix-sitemap";
import Layout from "~/components/layout";
import config from "~/config";
import { trpc } from "~/lib/trpc";

export const sitemap: SitemapFunction = () => ({
  priority: 0.3,
  changefreq: "monthly",
});

export const meta: MetaFunction = () => {
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
        <div className="prose w-9/12 py-6">
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

          <p>
            Peated is running version{" "}
            {config.VERSION ? (
              <a href={`${config.GITHUB_REPO}/commit/${config.VERSION}`}>
                {config.VERSION}
              </a>
            ) : (
              <em>an unknown version</em>
            )}
          </p>
        </div>
        <div className="hidden w-3/12 sm:block">
          <div className="prose py-6 text-center">
            <h1>Key Data</h1>
          </div>
          <Stats />
        </div>
      </div>
    </Layout>
  );
}

function Skeleton({ names }: { names: string[] }) {
  return (
    <div className="hidden items-center gap-4 text-center sm:grid sm:grid-cols-1 lg:grid-cols-2">
      {names.map((name) => (
        <SkeletonStat key={name} name={name} />
      ))}
    </div>
  );
}

function SkeletonStat({ name }: { name: string }) {
  return (
    <div className="animate-pulse">
      <div className="leading-7">{name}</div>
      <div className="order-first text-3xl font-semibold tracking-tight sm:text-5xl">
        &ndash;
      </div>
    </div>
  );
}

const Stats = () => {
  const { data, isLoading } = trpc.stats.useQuery();

  if (!data) {
    if (isLoading) {
      return <Skeleton names={["Tastings", "Bottles", "Entities"]} />;
    } else {
      return <div>Oops, maybe you're offline?</div>;
    }
  }

  const stats = [
    { name: "Tastings", value: data.totalTastings.toLocaleString() },
    { name: "Bottles", value: data.totalBottles.toLocaleString() },
    { name: "Entities", value: data.totalEntities.toLocaleString() },
  ];

  return (
    <div className="hidden items-center gap-4 text-center sm:grid sm:grid-cols-1 lg:grid-cols-2">
      {stats.map((stat) => (
        <div key={stat.name}>
          <div className="text-light leading-7">{stat.name}</div>
          <div className="order-first text-3xl font-semibold tracking-tight sm:text-5xl">
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
};
