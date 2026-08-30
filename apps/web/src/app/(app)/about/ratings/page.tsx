import {
  Card,
  CardGrid,
  DataTable,
  type DataTableColumn,
  RATING_BANDS,
} from "@peated/web/components";
import {
  ContentPage,
  ContentSection,
  ContentSubsection,
  ContentText,
} from "@peated/web/components/pages/contentPage.stylex";
import type { Metadata } from "next";

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
    align: "right",
    cell: (band) => band.range,
    header: "Range",
    key: "range",
  },
];

export default function RatingsPage() {
  return (
    <ContentPage
      eyebrow="Rating guide"
      intro="Choose one of five ratings for a tasting. Use a 100-point score for a written review."
      title="Tastings and reviews"
    >
      <CardGrid>
        <Card>
          <ContentSubsection title="Choose a tasting rating">
            <ContentText>
              Pick the label that best describes the whole whisky. The fixed
              vocabulary keeps quick tasting records easy to compare.
            </ContentText>
          </ContentSubsection>
        </Card>
        <Card>
          <ContentSubsection title="Score a review out of 100">
            <ContentText>
              Pick a whole number from 0 to 100. Add notes when the number needs
              context.
            </ContentText>
          </ContentSubsection>
        </Card>
      </CardGrid>

      <ContentSection title="How to write a review">
        <CardGrid>
          <Card>
            <ContentSubsection title="Taste first">
              <ContentText>
                Notice what stands out before thinking about a number.
              </ContentText>
            </ContentSubsection>
          </Card>
          <Card>
            <ContentSubsection title="Start at 80">
              <ContentText>
                An 80 is good: enjoyable, well made, and without a major
                problem.
              </ContentText>
            </ContentSubsection>
          </Card>
          <Card>
            <ContentSubsection title="Move the score">
              <ContentText>
                Judge the whisky as a whole. There are no points to add up.
              </ContentText>
            </ContentSubsection>
          </Card>
        </CardGrid>
        <ContentText>
          Move up when flavors are clear, the parts work well together, the
          texture has depth, and the finish lasts. Move down for off flavors,
          rough alcohol, thin texture, poor balance, or a short finish.
        </ContentText>
        <ContentText>
          Keep price, rarity, packaging, and reputation out of the score.
        </ContentText>
      </ContentSection>

      <ContentSection title="The score at a glance">
        <DataTable
          caption="Peated rating ranges"
          columns={bandColumns}
          getKey={(band) => band.key}
          items={RATING_BANDS}
        />
      </ContentSection>

      <ContentSection title="How bottle scores work">
        <ContentText>
          Peated shows a median after at least 20 eligible member and external
          review scores exist. External scores count only when the publication
          permits their use and uses a whole-number 100-point scale.
        </ContentText>
      </ContentSection>
    </ContentPage>
  );
}
