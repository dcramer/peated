import { RailList, RailListItem } from "@peated/web/components/lists.stylex";
import {
  PageSection,
  RailSection,
} from "@peated/web/components/pages/pageLayout.stylex";
import type { Metadata } from "next";
import {
  AboutLink,
  AboutPage,
  AboutText,
  AboutTextStack,
} from "../aboutPage.stylex";
import {
  BottleIdentityDecision,
  BottleRecordAnatomy,
  BottleRelationships,
  CatalogCertainty,
  CatalogRecordMap,
} from "./catalogGuide.stylex";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "The Whisky Catalog",
  description:
    "How Peated records whisky releases, connects them to brands and producers, and handles uncertain facts.",
};

export default function CatalogGuidePage() {
  return (
    <AboutPage
      currentHref="/about/catalog"
      description="How Peated records each whisky release, connects it to the people and companies behind it, and keeps uncertain facts honest."
      rail={
        <>
          <RailSection heading="Browse the catalog">
            <RailList ariaLabel="Browse the Peated catalog">
              <RailListItem href="/bottles" title="Bottles" />
              <RailListItem href="/brands" title="Brands" />
              <RailListItem href="/distillers" title="Distilleries" />
              <RailListItem href="/bottlers" title="Bottlers" />
            </RailList>
          </RailSection>
          <RailSection heading="Contribute">
            <RailList ariaLabel="Contribute to the Peated catalog">
              <RailListItem
                href="/addBottle?intent=catalog"
                metadata="Anything the catalog is missing"
                title="Record a bottle"
              />
              <RailListItem
                href="/bottles"
                metadata="Open any bottle record"
                title="Suggest a correction"
              />
            </RailList>
          </RailSection>
        </>
      }
      title="The whisky catalog"
    >
      <PageSection heading="A connected record">
        <CatalogRecordMap />
        <AboutText>
          Brands, distilleries, bottlers, and companies each have their own
          catalog record. One organization can fill more than one role; the
          bottle's links explain the part it played.
        </AboutText>
      </PageSection>

      <PageSection
        heading="What a bottle record can tell you"
        intro="Most bottles will not have every fact. Peated records what reliable evidence supports and leaves the rest open for a future correction."
      >
        <BottleRecordAnatomy />
      </PageSection>

      <PageSection heading="When is it a different bottle?">
        <AboutTextStack>
          <AboutText>
            A new record represents a release the producer marketed separately.
            A different package or shop listing does not create a new whisky by
            itself.
          </AboutText>
          <BottleIdentityDecision />
          <AboutText>
            Peated only separates releases when a label or another reliable
            source supports the difference.
          </AboutText>
        </AboutTextStack>
      </PageSection>

      <PageSection
        heading="Two ways bottles relate"
        intro="Related releases and a series answer different questions."
      >
        <BottleRelationships />
      </PageSection>

      <PageSection heading="A blank is not a no">
        <AboutTextStack>
          <AboutText>
            Some facts have 3 honest states: known, confirmed absent, and not
            yet known. Peated keeps those states separate instead of filling a
            gap with a guess.
          </AboutText>
          <CatalogCertainty />
        </AboutTextStack>
      </PageSection>

      <PageSection heading="Corrections keep the record intact">
        <AboutTextStack>
          <AboutText>
            Every bottle and organization in the catalog, plus every series, has
            a permanent Peated ID. When a record is corrected or a duplicate is
            removed, Peated preserves its links, tastings, reviews, and history
            rather than starting over.
          </AboutText>
          <AboutText>
            Missing something?{" "}
            <AboutLink href="/addBottle?intent=catalog">
              Record a bottle
            </AboutLink>
            , or open an existing bottle and suggest a correction.
          </AboutText>
        </AboutTextStack>
      </PageSection>
    </AboutPage>
  );
}
