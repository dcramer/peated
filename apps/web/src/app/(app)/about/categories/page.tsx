import {
  DataTable,
  RailList,
  RailListItem,
  type DataTableColumn,
} from "@peated/web/components";
import {
  PageSection,
  RailSection,
} from "@peated/web/components/pages/pageLayout.stylex";
import type { Metadata } from "next";
import { AboutPage, AboutText, AboutTextStack } from "../aboutPage.stylex";

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
    header: "Definition",
    key: "definition",
  },
];

export default function CategoriesPage() {
  return (
    <AboutPage
      currentHref="/about/categories"
      description="Peated records the most specific whisky style the bottle's label or another reliable source supports. Country and region stay separate from style."
      eyebrow={`Reference · ${categories.length} categories`}
      rail={
        <>
          <RailSection heading="Sources">
            <RailList ariaLabel="Whisky category sources">
              <RailListItem
                href="https://www.worldwhiskiesawards.com/shares/WWA_Categories_2026-Category-Definitions.pdf"
                metadata="Category definitions, 2026"
                title="World Whiskies Awards"
              />
              <RailListItem
                href="https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5/subpart-I/section-5.143"
                metadata="27 CFR 5.143"
                title="US whisky standards"
              />
              <RailListItem
                href="https://assets.publishing.service.gov.uk/media/5fd36667e90e07662ed92c85/Scotch_Whisky_Technical_File_-_June_2019.pdf"
                metadata="June 2019"
                title="Scotch Whisky technical file"
              />
            </RailList>
          </RailSection>
          <RailSection heading="Browse by category">
            <RailList ariaLabel="Browse bottles by category">
              <RailListItem
                href="/bottles?category=single_malt"
                title="Single malt"
              />
              <RailListItem href="/bottles?category=bourbon" title="Bourbon" />
              <RailListItem
                href="/bottles?category=blended_malt"
                title="Blended malt"
              />
              <RailListItem href="/bottles?category=rye" title="Rye whisky" />
            </RailList>
          </RailSection>
        </>
      }
      title="Whisky categories"
    >
      <PageSection heading="How a category gets chosen">
        <AboutTextStack>
          <AboutText>
            Local rules come first. When a country does not define a style,
            Peated uses the definitions below. A category stays blank until a
            label or another reliable source supports it. Submit a correction
            when one is missing or wrong.
          </AboutText>
          <AboutText>
            Always use the most specific category. Bourbon is not corn whisky.
            Rye, corn whisky, and wheat whisky are more specific than blended
            whisky or single grain. Blended malt and blended grain are more
            specific than blended whisky.
          </AboutText>
        </AboutTextStack>
      </PageSection>

      <PageSection heading="Definitions">
        <DataTable
          caption="Peated whisky category definitions"
          columns={categoryColumns}
          getKey={(category) => category.category}
          items={categories}
        />
        <AboutText>
          Local rules can be stricter than these definitions.
        </AboutText>
      </PageSection>
    </AboutPage>
  );
}
