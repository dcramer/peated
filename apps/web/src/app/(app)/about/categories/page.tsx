import { DataTable, type DataTableColumn } from "@peated/web/components";
import {
  ContentLink,
  ContentPage,
  ContentSection,
  ContentText,
} from "@peated/web/components/pages/contentPage.stylex";
import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Whisky Category Guide",
  description: "How Peated classifies whisky styles across regions.",
};

const categories = [
  {
    category: "Blended whisky",
    definition:
      "Whisky sold as blended whisky. It usually combines malt whisky and grain whisky. Use a more specific category when the label gives one.",
  },
  {
    category: "Blended grain",
    definition: "A blend of grain whiskies from more than one distillery.",
  },
  {
    category: "Blended malt",
    definition:
      "A blend of single malt whiskies from more than one distillery. It does not contain grain whisky.",
  },
  {
    category: "Bourbon",
    definition:
      "American whiskey made from a recipe with at least 51% corn and aged in new charred oak. Other US bourbon rules also apply.",
  },
  {
    category: "Corn whisky",
    definition:
      "Whisky sold as corn whisky under local rules. If no local rule exists, corn must make up at least 51% of the recipe. American corn whiskey requires at least 80% corn. Peated records bourbon as bourbon, not corn whisky.",
  },
  {
    category: "Rye whisky",
    definition:
      "Whisky sold as rye whisky under local rules. If no local rule exists, rye must make up at least 51% of the recipe.",
  },
  {
    category: "Single grain",
    definition:
      "Grain whisky made at one distillery. Despite the name, it can use more than one grain.",
  },
  {
    category: "Single malt",
    definition:
      "Whisky made from only malted barley at one distillery. Other local rules also apply.",
  },
  {
    category: "Single pot still",
    definition:
      "Whisky made in pot stills at one distillery from malted and unmalted barley. Local rules set the proportions and any other permitted grains.",
  },
  {
    category: "Wheat whisky",
    definition:
      "Whisky sold as wheat whisky under local rules. If no local rule exists, wheat must make up at least 51% of the recipe.",
  },
] as const;

type CategoryDefinition = (typeof categories)[number];

const categoryColumns: DataTableColumn<CategoryDefinition>[] = [
  {
    cell: (category) => category.category,
    header: "Category",
    key: "category",
  },
  {
    cell: (category) => category.definition,
    header: "Peated baseline",
    key: "definition",
  },
];

export default function CategoriesPage() {
  return (
    <ContentPage
      eyebrow="Category guide"
      intro="Peated records the most specific whisky style supported by the bottle's label or another reliable source. Country and region stay separate."
      title="Whisky categories"
    >
      <ContentSection title="How Peated chooses a category">
        <ContentText>
          Local rules come first. When a country does not define a style, Peated
          uses the baselines below. A category stays blank until a label or
          another reliable source supports it. You can submit a correction when
          a category is missing or wrong.
        </ContentText>
        <ContentText>
          Use the most specific category. Bourbon is not corn whisky. Rye, corn
          whisky, and wheat whisky are more specific than blended whisky or
          single grain. Blended malt and blended grain are more specific than
          blended whisky.
        </ContentText>
      </ContentSection>

      <ContentSection title="Category definitions">
        <DataTable
          caption="Peated whisky category definitions"
          columns={categoryColumns}
          getKey={(category) => category.category}
          items={categories}
        />
      </ContentSection>

      <ContentSection title="References">
        <ContentText>
          These baselines use the{" "}
          <ContentLink href="https://www.worldwhiskiesawards.com/shares/WWA_Categories_2026-Category-Definitions.pdf">
            World Whiskies Awards definitions
          </ContentLink>
          , the{" "}
          <ContentLink href="https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5/subpart-I/section-5.143">
            United States whisky standards
          </ContentLink>
          , and the{" "}
          <ContentLink href="https://assets.publishing.service.gov.uk/media/5fd36667e90e07662ed92c85/Scotch_Whisky_Technical_File_-_June_2019.pdf">
            Scotch Whisky technical file
          </ContentLink>
          . Local rules can be stricter than these baselines.
        </ContentText>
      </ContentSection>
    </ContentPage>
  );
}
