import { RailList, RailListItem } from "@peated/web/components";
import { PageSection } from "@peated/web/components/pages/pageLayout.stylex";
import type { Metadata } from "next";
import { AboutPage, AboutText, AboutTextStack } from "../aboutPage.stylex";
import {
  TastingWheelFamilies,
  TastingWheelIntroduction,
} from "./tastingWheel.stylex";

import { TastingWheelProvider } from "@peated/web/features/tastingWheel/tastingWheelDetails.stylex";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Whisky Tasting Wheel",
  description: "Find plain words for a whisky's smells and flavors.",
};

export default function TastingWheelPage() {
  return (
    <TastingWheelProvider>
      <AboutPage
        currentHref="/about/tasting-wheel"
        description="Find words for what you smell and taste."
        title="Tasting wheel"
      >
        <TastingWheelIntroduction />

        <PageSection
          heading="Tasting notes"
          intro="Browse the flavor families below. These words are suggestions, not a checklist."
        >
          <TastingWheelFamilies />
        </PageSection>

        <PageSection heading="About this wheel">
          <AboutTextStack>
            <AboutText>
              Peated uses the Wine &amp; Spirit Education Trust&apos;s 2025
              tasting guide as its main source. We also looked at tasting wheels
              for Scotch, American whiskey, and Canadian whisky. None uses these
              exact flavor families.
            </AboutText>
            <AboutText>
              Some guides put words together because they can have the same
              cause. Peated puts words together when they smell or taste alike.
              One note can have more than one cause.
            </AboutText>
            <AboutText>
              The flavor profile on a bottle page shows how often its public
              tastings mention each family. On distillery and region pages, it
              shows how common each family is across bottles with notes. These
              profiles show commonality, not intensity.
            </AboutText>
          </AboutTextStack>
          <RailList ariaLabel="Tasting wheel sources">
            <RailListItem
              href="https://www.wsetglobal.com/media/16506/wset_l3spirits_sat_en_feb2025_issue3.pdf"
              metadata="Tasting guide for spirits, 2025"
              title="Wine & Spirit Education Trust"
            />
            <RailListItem
              href="https://www.scotch-whisky.org.uk/media/1714/swa-tasting-toolkit_2020.pdf"
              metadata="Scotch whisky tasting wheel, 2020"
              title="Scotch Whisky Research Institute"
            />
            <RailListItem
              href="https://whiskymag.com/articles/tasting-wheel/"
              metadata="Charles MacLean's whisky tasting wheel"
              title="Whisky Magazine"
            />
            <RailListItem
              href="https://www.woodfordreserve.com/flavor-wheels/"
              metadata="American whiskey tasting wheels"
              title="Woodford Reserve"
            />
            <RailListItem
              href="https://www.jpwisers.com/wp-content/uploads/Whisky-Wheel-Dr-Don-Livermore.pdf"
              metadata="Canadian whisky flavor wheel"
              title="J.P. Wiser's"
            />
            <RailListItem
              href="https://www.drjimswan.com/flavour-wheel/"
              metadata="How the first whisky tasting wheel was made"
              title="Dr Jim Swan"
            />
          </RailList>
        </PageSection>
      </AboutPage>
    </TastingWheelProvider>
  );
}
