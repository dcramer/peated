import { BOT_USER_AGENT } from "@peated/server/constants";
import {
  ContentLink,
  ContentList,
  ContentPage,
  ContentSection,
  ContentText,
} from "@peated/web/components/pages/contentPage.stylex";
import config from "@peated/web/config";
import type { Metadata } from "next";

export const dynamic = "force-static";

const KEY_DIRECTORY_URL =
  "https://peated.com/.well-known/http-message-signatures-directory";
const WEB_BOT_AUTH_URL =
  "https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth/";

export const metadata: Metadata = {
  title: "PeatedBot",
  description:
    "What PeatedBot reads, how it limits requests, and how site owners can control access.",
};

export default function BotPage() {
  return (
    <ContentPage
      intro="PeatedBot reads public whisky information so Peated can keep an accurate, freely available catalog."
      title="PeatedBot"
    >
      <ContentSection title="What it reads">
        <ContentText>
          PeatedBot reads public catalog and product pages for bottle names,
          producers, ages, strengths, release years, images, prices, and
          availability. It reads public review pages for titles, writers, dates,
          scores, bottle names, and review text.
        </ContentText>
        <ContentText>
          Peated stores bottle facts, source links, and credit to the original
          website. Full review text may be stored privately so Peated can
          improve how it reads pages without requesting them again. Peated does
          not publish that full text.
        </ContentText>
      </ContentSection>
      <ContentSection title="How it behaves">
        <ContentList>
          <li>It identifies every request with the user agent below.</li>
          <li>It follows robots.txt rules written for PeatedBot.</li>
          <li>
            Each website has its own request limit. PeatedBot spreads those
            requests across the hour.
          </li>
          <li>
            It obeys HTTP 429 responses and waits for the time named in
            Retry-After.
          </li>
          <li>It limits each run, request, retry, and download.</li>
          <li>It does not bypass authentication or access controls.</li>
        </ContentList>
      </ContentSection>
      <ContentSection title="Identify a request">
        <ContentList>
          <li>
            User agent: <code>{BOT_USER_AGENT}</code>
          </li>
          <li>
            robots.txt name: <code>PeatedBot</code>
          </li>
          <li>
            Signature agent: <code>&quot;https://peated.com&quot;</code>
          </li>
          <li>
            Public key directory:{" "}
            <ContentLink href={KEY_DIRECTORY_URL}>
              {KEY_DIRECTORY_URL}
            </ContentLink>
          </li>
          <li>
            Signing algorithm: <code>Ed25519</code>
          </li>
        </ContentList>
        <ContentText>
          Production requests include <code>Signature-Agent</code>,{" "}
          <code>Signature-Input</code>, and <code>Signature</code> headers. A
          website or its network provider can use these headers and the public
          key directory to confirm that a request came from Peated.
        </ContentText>
      </ContentSection>
      <ContentSection title="Request signing and public keys">
        <ContentText>
          PeatedBot uses{" "}
          <ContentLink href={WEB_BOT_AUTH_URL}>Web Bot Auth</ContentLink>, which
          signs each request with a private key held by Peated. The public key
          directory is a signed JSON Web Key Set (JWKS), a standard list of
          public keys. It never includes the private key.
        </ContentText>
        <ContentText>
          Public keys can change during a planned key rotation. Services that
          verify PeatedBot should read the directory instead of saving a copy of
          its current key.
        </ContentText>
      </ContentSection>
      <ContentSection title="Control access">
        <ContentText>
          Site owners can block all PeatedBot requests by adding a robots.txt
          group for <code>PeatedBot</code> with <code>Disallow: /</code>. A more
          specific rule can allow or block individual paths. After 24 hours,
          Peated checks robots.txt again before making another request.
        </ContentText>
      </ContentSection>
      <ContentSection title="Contact">
        <ContentText>
          If our traffic causes a problem, contact us through the{" "}
          <ContentLink href={`${config.GITHUB_REPO}/issues`}>
            Peated issue tracker
          </ContentLink>{" "}
          or the{" "}
          <ContentLink href={config.DISCORD_LINK}>Peated Discord</ContentLink>.
          Include the hostname, affected paths, UTC request times, HTTP status,
          and a request ID from your network provider if one is available. Do
          not post full request headers in a public issue. We will pause a
          source while investigating an access or rate problem.
        </ContentText>
      </ContentSection>
    </ContentPage>
  );
}
