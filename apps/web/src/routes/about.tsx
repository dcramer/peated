import Layout from "../components/layout";
import config from "../config";

export default function About() {
  return (
    <Layout title="About">
      <div className="prose p-6">
        <h1>About Peated</h1>
        <p>
          Peated, inspired by apps like Untapped and Vivino, aims to create a
          rich social experience around tasting and collecting Whiskey. We
          leverage modern and open source technology to go beyond the typical
          experiences you see elsewhere.
        </p>
        <p>
          Core to our goals is a spirit database heavily focused on reliability
          and quality of data. This database has been bootstrapped by collating
          various sources of data, and is curated by the community. Most
          importantly, its available via a modern web API, the same API which
          powers the application experiences.
        </p>
        <p>
          Peated was started by{" "}
          <a href="https://twitter.com/zeeg">David Cramer</a> and is{" "}
          <a href={config.GITHUB_REPO}>Open Source on GitHub</a>. A{" "}
          <a href={config.DISCORD_LINK}>Discord server</a> is available if you
          want to contribute.
        </p>
      </div>
    </Layout>
  );
}
