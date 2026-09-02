import { RailList, RailListItem } from "@peated/web/components";
import {
  PageSection,
  RailSection,
} from "@peated/web/components/pages/pageLayout.stylex";
import type { Metadata } from "next";
import {
  AboutPage,
  AboutText,
  AboutTextStack,
  ReviewSteps,
} from "../aboutPage.stylex";
import {
  TastingWheelFamilies,
  TastingWheelGraphic,
} from "./tastingWheel.stylex";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Whisky Tasting Wheel",
  description: "Find plain words for a whisky's smells and flavors.",
};

export default function TastingWheelPage() {
  return (
    <AboutPage
      currentHref="/about/tasting-wheel"
      description="Start with 1 of 9 groups. Then choose a more specific smell or flavor. Every example below appears in Peated's tasting form."
      eyebrow="Reference · 9 groups"
      rail={
        <>
          <RailSection heading="Sources">
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
          </RailSection>
          <RailSection heading="Groups">
            <RailList ariaLabel="Tasting wheel groups">
              <RailListItem href="#tasting-note-cereal" title="Cereal" />
              <RailListItem href="#tasting-note-fruit" title="Fruit" />
              <RailListItem href="#tasting-note-floral" title="Floral" />
              <RailListItem href="#tasting-note-smoke" title="Smoke" />
              <RailListItem href="#tasting-note-earthy" title="Earthy" />
              <RailListItem href="#tasting-note-sulfur" title="Sulfur" />
              <RailListItem href="#tasting-note-sweet" title="Sweet" />
              <RailListItem href="#tasting-note-spice" title="Spice" />
              <RailListItem href="#tasting-note-wood" title="Wood" />
            </RailList>
          </RailSection>
          <RailSection heading="Use the wheel">
            <RailList ariaLabel="Use the tasting wheel">
              <RailListItem
                href="/addBottle?intent=tasting"
                metadata="Add your tasting notes"
                title="Log a tasting"
              />
              <RailListItem href="/about/ratings" title="Rating guide" />
            </RailList>
          </RailSection>
        </>
      }
      title="Tasting wheel"
    >
      <PageSection heading="Find the right words">
        <TastingWheelGraphic />
      </PageSection>

      <PageSection heading="Use the wheel">
        <ReviewSteps
          steps={[
            {
              body: "Choose the group that best matches what you smell, taste, or notice after a sip.",
              title: "Start broad",
            },
            {
              body: "Choose a more specific word if one fits.",
              title: "Choose a word",
            },
            {
              body: "Use only the words you notice. You do not need one from every group.",
              title: "Stop when it fits",
            },
          ]}
        />
      </PageSection>

      <PageSection
        heading="The 9 groups"
        intro="These are words you can choose in Peated's tasting form. They are examples, not a checklist."
      >
        <TastingWheelFamilies />
      </PageSection>

      <PageSection heading="How we chose the groups">
        <AboutTextStack>
          <AboutText>
            Peated uses the Wine &amp; Spirit Education Trust&apos;s 2025
            tasting guide as its main source. We also looked at tasting wheels
            for Scotch, American whiskey, and Canadian whisky. None uses these
            exact 9 groups.
          </AboutText>
          <AboutText>
            Some guides put words together because they can have the same cause.
            Peated puts words together when they smell or taste alike. One note
            can have more than one cause.
          </AboutText>
        </AboutTextStack>
      </PageSection>

      <PageSection heading="The wheel and bottle pages">
        <AboutTextStack>
          <AboutText>
            Use the wheel to describe one tasting. Choose words from any part of
            it, in any order.
          </AboutText>
          <AboutText>
            A bottle page can also show one broad flavor, such as Light &amp;
            Delicate or Heavily Peated. That broad flavor does not limit the
            words you can choose.
          </AboutText>
        </AboutTextStack>
      </PageSection>
    </AboutPage>
  );
}
