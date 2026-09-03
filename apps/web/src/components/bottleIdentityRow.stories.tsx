import { mockBottle } from "@peated/server/orpc/mock/fixtures";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { BottleRowActionControls } from "@peated/web/hooks/useBottleRowActions";

import BottleImage from "../../../../packages/bottle-classifier/src/eval-fixtures/assets/photo-add-bottle-misses/laphroaig-elements-l2.0.webp";
import { BottleIdentityRow } from "./bottleIdentityRow.stylex";
import { BottleRowActions } from "./bottleRowActions.stylex";
import { CommunityFeed } from "./communityFeed.stylex";
import { LoadingList } from "./feedback.stylex";
import { ItemList, ItemListItem } from "./itemList.stylex";
import { SearchResults } from "./searchResults.stylex";
import { SectionHeading } from "./sectionHeading.stylex";
import { SelectedBottleSummary } from "./selectedBottleSummary.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";
import { TastingEntry } from "./tastingEntry.stylex";

const bottleActions = {
  groupsFor: () => [
    [{ label: "Log a tasting", onSelect: () => undefined }],
    [{ label: "Remove from Library", onSelect: () => undefined }],
  ],
  isLibrary: () => true,
} satisfies BottleRowActionControls;

const rowBottle = {
  ...mockBottle,
  brand: { ...mockBottle.brand, name: "Laphroaig", shortName: null },
  name: "Elements L 2.0",
  group: undefined,
  releaseYear: 2024,
  statedAge: null,
  abv: 59.6,
  imageUrl: BottleImage.src,
};

const meta = {
  title: "Components/Bottles/Bottle Identity Row",
  component: BottleIdentityRow,
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
  args: {
    ...toBottleListItem(rowBottle),
    href: "/bottles/19936",
    imageUrl: BottleImage.src,
  },
  parameters: {
    docs: {
      description: {
        component:
          "Use Bottle Identity Row wherever a standard bottle row appears. toBottleListItem and getBottleIdentityProps supply the same marketed name, provenance, and release facts used on the homepage and in Library. Rows share a 48 × 64px thumbnail on desktop and 42 × 58px on mobile. Producer links, related releases, and action menus remain separate controls.",
      },
    },
  },
} satisfies Meta<typeof BottleIdentityRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <ItemList ariaLabel="Bottle identity examples">
      <ItemListItem>
        <BottleIdentityRow {...args} />
      </ItemListItem>
      <ItemListItem>
        <BottleIdentityRow
          align="start"
          href="/bottles/19936"
          imageUrl={BottleImage.src}
          metadata={["2026 release", "10 years", "50% ABV"]}
          name="SMWS Highland peaty potion"
          subtitle="Highland · Single Malt"
        />
      </ItemListItem>
      <ItemListItem>
        <BottleIdentityRow
          provenance={[{ name: "Single Malt" }]}
          href="/bottles/42"
          imageUrl={null}
          metadata={["16 years", "43.0% ABV", "Distillers Edition"]}
          name="Lagavulin 16-year-old"
          relatedReleases={{ count: 3, href: "/bottles/42/releases" }}
        />
      </ItemListItem>
      <ItemListItem>
        <BottleIdentityRow {...args} hasTasted isLibrary />
      </ItemListItem>
      <ItemListItem>
        <BottleIdentityRow {...args} isLibrary />
      </ItemListItem>
      <ItemListItem>
        <BottleIdentityRow {...args} hasTasted />
      </ItemListItem>
      <ItemListItem>
        <BottleIdentityRow
          {...args}
          end={
            <BottleRowActions
              bottle={{ id: 42, isLibrary: true }}
              controls={bottleActions}
              label={args.name}
            />
          }
          isLibrary
        />
      </ItemListItem>
      <ItemListItem>
        <BottleIdentityRow
          provenance={[{ name: "Single Malt" }]}
          href="/bottles/18481"
          imageUrl={null}
          metadata={["61.5% ABV", "2024 release", "Islay barley"]}
          name="Bruichladdich Octomore Edition 15.3 Islay Barley Super Heavily Peated"
        />
      </ItemListItem>
    </ItemList>
  ),
};

export const RowLayouts: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Compare the actual bottle, activity, tasting, search, selection, and loading components at wide and phone widths. They share thumbnail geometry and row typography. Use BottleVisual's small size only for compact two-line rails; BottleIdentityRow always uses the standard size.",
      },
    },
  },
  render: (args) => {
    const title = args.name;
    const metadata = args.metadata?.join(" · ") ?? "";
    return (
      <StoryStack>
        <section aria-label="Bottle list">
          <SectionHeading level={3}>Bottle list</SectionHeading>
          <BottleIdentityRow {...args} />
        </section>
        <section aria-label="Activity">
          <SectionHeading level={3}>
            Activity on the homepage and activity page
          </SectionHeading>
          <CommunityFeed
            items={[
              {
                actor: "Whiskyfun",
                bottle: args,
                actorHref: "https://example.com/review",
                bottleHref: args.href!,
                date: "2026-08-24T12:00:00.000Z",
                href: "https://example.com/review",
                id: "review",
                imageUrl: args.imageUrl,
                metadata,
                score: 88,
                title,
              },
            ]}
          />
        </section>
        <section aria-label="Tasting">
          <SectionHeading level={3}>Tasting</SectionHeading>
          <TastingEntry
            author="j.macleod"
            date="August 24"
            members={[
              {
                href: args.href,
                bottle: args,
                imageUrl: args.imageUrl,
                metadata,
                name: title,
                ratingBand: "outstanding",
              },
            ]}
          />
        </section>
        <section aria-label="Search">
          <SectionHeading level={3}>Search</SectionHeading>
          <SearchResults
            embedded
            groups={[
              {
                id: "bottles",
                label: "Bottles",
                items: [
                  {
                    href: args.href!,
                    bottle: args,
                    id: "bottle",
                    metadata,
                    title,
                    visual: {
                      kind: "bottle",
                      imageUrl: args.imageUrl,
                      label: title,
                    },
                  },
                ],
              },
            ]}
            query=""
          />
        </section>
        <section aria-label="Selection">
          <SectionHeading level={3}>Selected bottle</SectionHeading>
          <SelectedBottleSummary
            bottle={rowBottle}
            imageUrl={args.imageUrl}
            onChange={() => undefined}
          />
        </section>
        <section aria-label="Loading">
          <SectionHeading level={3}>Loading</SectionHeading>
          <LoadingList rows={1} />
        </section>
      </StoryStack>
    );
  },
};

export const InteractionStates: Story = {
  render: (args) => (
    <StoryStack>
      <ItemList ariaLabel="Bottle row interaction states">
        <ItemListItem id="bottle-row-default">
          <BottleIdentityRow {...args} name="Default" />
        </ItemListItem>
        <ItemListItem id="bottle-row-hovered">
          <BottleIdentityRow {...args} name="Hovered" />
        </ItemListItem>
        <ItemListItem id="bottle-row-focused">
          <BottleIdentityRow {...args} name="Keyboard focused" />
        </ItemListItem>
        <ItemListItem id="bottle-row-nested">
          <BottleIdentityRow
            {...args}
            name="Primary bottle with brand and release links"
            relatedReleases={{ count: 3, href: "#releases" }}
          />
        </ItemListItem>
        <ItemListItem id="bottle-row-pressed">
          <BottleIdentityRow {...args} name="Pressed" />
        </ItemListItem>
      </ItemList>
    </StoryStack>
  ),
  parameters: {
    pseudo: {
      active: [
        "#bottle-row-pressed > div",
        '#bottle-row-pressed a[href="/bottles/19936"]',
      ],
      focusVisible: ['#bottle-row-focused a[href="/bottles/19936"]'],
      focusWithin: ["#bottle-row-focused > div"],
      hover: [
        "#bottle-row-hovered > div",
        '#bottle-row-hovered a[href="/bottles/19936"]',
      ],
    },
  },
};
