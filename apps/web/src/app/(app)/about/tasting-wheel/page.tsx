import { RailList, RailListItem } from "@peated/web/components";
import { PageSection } from "@peated/web/components/pages/pageLayout.stylex";
import type { Metadata } from "next";
import { AboutPage, AboutText, AboutTextStack } from "../aboutPage.stylex";
import {
  TastingWheelCategories,
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
        description="Know the taste, but can’t quite name it? The wheel gives you a few words to try."
        title="Tasting wheel"
      >
        <TastingWheelIntroduction />

        <PageSection
          heading="Tasting notes"
          intro="These are the notes you can choose when you log a tasting."
        >
          <TastingWheelCategories />
        </PageSection>

        <PageSection heading="About this wheel">
          <AboutTextStack>
            <AboutText>
              Our starting point was the Wine &amp; Spirit Education
              Trust&apos;s 2025 tasting guide, alongside wheels for Scotch,
              American whiskey, and Canadian whisky. The 9 categories here are
              our own arrangement of those ideas.
            </AboutText>
            <AboutText>
              The categories reflect what the notes remind you of. You
              don&apos;t need to know whether a flavor came from the grain, the
              still, or the cask to put a name to it.
            </AboutText>
            <AboutText>
              On a bottle page, a larger slice means more public tastings
              mention that category. On distillery and region pages, it means
              more bottles have those notes. Neither tells you how strong a
              flavor tastes, and your notes don&apos;t have to match anyone
              else&apos;s.
            </AboutText>
          </AboutTextStack>
        </PageSection>

        <PageSection heading="Sources and references">
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
