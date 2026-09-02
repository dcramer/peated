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
      description="A tasting takes one of five ratings. A written review takes a whole number out of 100. Neither is ever converted into the other."
      eyebrow="Reference · two measures"
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
            A bottle shows a median from the first eligible score onward. It
            never shows an average or a number converted from tasting ratings.
          </AboutText>
          <AboutText>
            An external score counts only when the publication permits its use
            and scores on a whole-number 100-point scale. A publication on its
            own scale gets an en dash beside its quote.
          </AboutText>
        </AboutTextStack>
      </PageSection>
    </AboutPage>
  );
}
