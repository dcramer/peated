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
      description="Tastings use five named ratings. Reviews keep their original scores. Bottle ratings show both without turning a tasting into an exact score."
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
          Pick the rating that describes the whole whisky. The same five choices
          on every tasting make bottles easier to compare.
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
            We put the review scores in order and use the middle one. With an
            even number of scores, we use the lower of the middle two. The word
            beside the score matches its range. A score of 91 is Outstanding.
          </AboutText>
          <AboutText>
            Review sites use different scales. We keep each original score and
            link to its review. When a site's scoring guide gives us enough
            information, Peated also works out a score out of 100.
          </AboutText>
          <AboutText>
            Each critic review says whether its score is used. Reviews without a
            usable score or a saved comparison are left out. Whole-number scores
            out of 100 are used unless the site is excluded or its saved
            settings say otherwise.
          </AboutText>
          <AboutText>
            On a bottle page, the bar groups member and critic scores with
            tastings in the same five ranges. If a bottle has tastings but no
            review score, its middle tasting sets the rating. Peated shows the
            full range instead of an exact score.
          </AboutText>
        </AboutTextStack>
      </PageSection>
    </AboutPage>
  );
}
