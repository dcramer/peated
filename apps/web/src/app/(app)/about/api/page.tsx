import { RailList, RailListItem } from "@peated/web/components";
import {
  PageSection,
  RailSection,
} from "@peated/web/components/pages/pageLayout.stylex";
import config from "@peated/web/config";
import type { Metadata } from "next";
import {
  AboutCode,
  AboutLink,
  AboutPage,
  AboutText,
  AboutTextStack,
} from "../aboutPage.stylex";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Peated API",
  description:
    "How to read Peated's public whisky catalog through its JSON API.",
};

const bottleSearch =
  'curl "https://api.peated.com/v1/bottles?query=Ardbeg&limit=10"';

export default function ApiPage() {
  return (
    <AboutPage
      currentHref="/about/api"
      description="Peated publishes its whisky catalog through a JSON API."
      eyebrow="Reference · JSON over HTTPS"
      rail={
        <RailSection heading="API resources">
          <RailList ariaLabel="Peated API resources">
            <RailListItem
              href="https://api.peated.com"
              metadata="Browse paths and response fields"
              title="Live API reference"
            />
            <RailListItem
              href="https://api.peated.com/spec.json"
              metadata="OpenAPI 3.1 JSON"
              title="OpenAPI specification"
            />
            <RailListItem href={config.GITHUB_REPO} title="Source on GitHub" />
            <RailListItem
              href={config.DISCORD_LINK}
              metadata="Ask about access or integrations"
              title="Peated on Discord"
            />
          </RailList>
        </RailSection>
      }
      title="Peated API"
    >
      <PageSection heading="Read the catalog">
        <AboutTextStack>
          <AboutText>
            The API lives at{" "}
            <AboutLink href="https://api.peated.com/v1">
              api.peated.com/v1
            </AboutLink>
            . Call it from a command line or server. Public catalog GET requests
            return JSON without a token.
          </AboutText>
          <AboutCode>{bottleSearch}</AboutCode>
          <AboutText>
            This searches bottle names for “Ardbeg” and returns up to 10
            matches. Bottle lists put records in <code>results</code>. When
            <code> rel.nextCursor</code> contains a number, pass that number as
            <code> cursor</code> to read the next page. A page can contain up to
            100 records.
          </AboutText>
        </AboutTextStack>
      </PageSection>

      <PageSection heading="API reference">
        <AboutText>
          The{" "}
          <AboutLink href="https://api.peated.com">
            live API reference
          </AboutLink>{" "}
          lists every path, query parameter, and response field. Tools that read
          OpenAPI can use the{" "}
          <AboutLink href="https://api.peated.com/spec.json">
            JSON specification
          </AboutLink>
          .
        </AboutText>
      </PageSection>

      <PageSection heading="Account access">
        <AboutTextStack>
          <AboutText>
            Actions tied to a member need an OAuth bearer token. Peated
            registers OAuth clients manually; ask in{" "}
            <AboutLink href={config.DISCORD_LINK}>Discord</AboutLink> if you are
            building an integration.
          </AboutText>
          <AboutText>
            Identify automated clients when possible, keep request rates
            reasonable, and do not degrade the service.
          </AboutText>
        </AboutTextStack>
      </PageSection>
    </AboutPage>
  );
}
