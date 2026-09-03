import {
  DataTable,
  RailList,
  RailListItem,
  RATING_BANDS,
  TastingRating,
  type DataTableColumn,
} from "@peated/web/components";
import {
  PageSection,
  RailSection,
} from "@peated/web/components/pages/pageLayout.stylex";
import type { Metadata } from "next";
import {
  AboutPage,
  AboutText,
  AboutTextStack,
  ReviewDirections,
  ReviewSteps,
} from "../aboutPage.stylex";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Whisky Rating Guide",
  description:
    "A simple guide to Peated tasting ratings and 100-point reviews.",
};

const bandColumns: DataTableColumn<(typeof RATING_BANDS)[number]>[] = [
  {
    cell: (band) => band.label,
    header: "Rating",
    key: "label",
  },
  {
    cell: (band) => band.range,
    header: "Range",
    key: "range",
  },
  {
    align: "right",
    cell: (band) => <TastingRating band={band.key} />,
    header: "Marker",
    key: "marker",
    priority: "secondary",
  },
];

export default function RatingsPage() {
  return (
    <AboutPage
      currentHref="/about/ratings"
      description="A tasting takes one of five ratings. A member review takes a whole number out of 100. Neither is ever converted into the other."
      rail={
        <RailSection heading="Where these appear">
          <RailList ariaLabel="Rating examples">
            <RailListItem
              href="/addBottle?intent=tasting"
              metadata="Where the five ratings are used"
              title="Log a tasting"
            />
            <RailListItem
              href="/bottles?sort=-score"
              metadata="Ordered by median review score"
              title="Scored bottles"
            />
            <RailListItem href="/activity" title="Activity" />
          </RailList>
        </RailSection>
      }
      title="Rating guide"
    >
      <PageSection heading="The five ratings">
        <DataTable
          caption="Peated tasting ratings"
          columns={bandColumns}
          getKey={(band) => band.key}
          items={RATING_BANDS}
        />
        <AboutText>
          Pick the label that describes the whole whisky. The vocabulary is
          fixed on purpose. Five labels stay comparable across many tastings in
          a way that free-form numbers do not.
        </AboutText>
      </PageSection>

      <PageSection heading="Writing a review">
        <ReviewSteps
          steps={[
            {
              body: "Notice what stands out before you think about a number.",
              title: "Taste first",
            },
            {
              body: "An 80 is good: enjoyable, well made, and without a major problem.",
              title: "Start at 80",
            },
            {
              body: "Judge the whisky as a whole. There are no points to add up.",
              title: "Move the score",
            },
          ]}
        />
        <ReviewDirections
          down="Off flavors, rough alcohol, thin texture, poor balance, or a finish that stops short."
          up="Clear flavors, parts that work together, texture with depth, or a finish that lasts."
        />
        <AboutText>
          Keep price, rarity, packaging, and reputation out of it.
        </AboutText>
      </PageSection>

      <PageSection heading="How a bottle score is worked out">
        <AboutTextStack>
          <AboutText>
            We line up the included review scores from lowest to highest and
            take the middle one. This is the median. With two middle scores, we
            use the lower one. The count tells you how many scores went in;
            tasting ratings are kept separate.
          </AboutText>
          <AboutText>
            Review sites use different scales. We keep each original score and
            link to its review. When a site's scoring guide makes the scales
            comparable, Peated can estimate a score out of 100.
          </AboutText>
          <AboutText>
            Each review says whether its score is included. Reviews without a
            usable score or a saved comparison are left out, so the score count
            can be smaller than the review count. Existing whole-number scores
            out of 100 count unless the site is excluded or its saved settings
            say otherwise.
          </AboutText>
        </AboutTextStack>
      </PageSection>
    </AboutPage>
  );
}
