import config from "@peated/web/config";
import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "PeatedBot",
  description: "How Peated's catalog bot accesses public whisky information.",
};

export default function BotPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="prose prose-invert max-w-none">
        <h1>PeatedBot</h1>
        <p>
          PeatedBot collects public whisky catalog, availability, and review
          metadata so Peated can help people discover bottles and link back to
          the original source.
        </p>

        <h2>How it behaves</h2>
        <ul>
          <li>Identifies requests as PeatedBot and links to this page.</li>
          <li>Honors robots.txt and source-specific access approval.</li>
          <li>
            Limits concurrent requests, spaces them out, and obeys 429 backoff.
          </li>
          <li>Uses bounded runs, timeouts, retries, and response sizes.</li>
          <li>Does not attempt to bypass authentication or access controls.</li>
        </ul>
        <p>
          Peated stores normalized facts and links, not fetched page bodies. For
          third-party reviews, Peated is designed to show attribution, a short
          summary where permitted, and a link that sends readers to the original
          publisher rather than republishing the full review.
        </p>

        <h2>Contact</h2>
        <p>
          If our traffic is causing a problem or you want to discuss how your
          site is represented, contact us through the{" "}
          <a href={`${config.GITHUB_REPO}/issues`}>Peated issue tracker</a> or{" "}
          <a href={config.DISCORD_LINK}>Peated Discord</a>. Include the affected
          hostname and any relevant request times so we can respond quickly.
        </p>
      </div>
    </div>
  );
}
