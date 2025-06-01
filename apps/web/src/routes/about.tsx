import config from "@peated/web/config";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import Stats, { StatsSkeleton } from "./stats";
export const Route = createFileRoute("/about")({
  component: Page,
});

function Page() {
  return (
    <>
      <div className="flex gap-4 px-2 sm:px-0">
        <div className="prose prose-invert w-9/12 py-6">
          <h1>The Mission</h1>
          <p>
            Peated, inspired by apps like Untappd and Vivino, aims to create a
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
          <div className="prose prose-invert py-6 text-center">
            <h1>Key Data</h1>
          </div>
          <Suspense fallback={<StatsSkeleton />}>
            <Stats />
          </Suspense>
        </div>
      </div>
    </>
  );
}
