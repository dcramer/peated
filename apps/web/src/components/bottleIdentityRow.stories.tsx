import { mockBottle } from "@peated/server/orpc/mock/fixtures";
import {
  toBottleListItem,
  toBottlePickerOption,
} from "@peated/web/lib/bottleListItem";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { BottleRowActionControls } from "@peated/web/hooks/useBottleRowActions";

import BottleImage from "../../../../packages/bottle-classifier/src/eval-fixtures/assets/photo-add-bottle-misses/laphroaig-elements-l2.0.webp";
import { BottleIdentityRow } from "./bottleIdentityRow.stylex";
import { BottleRowActions } from "./bottleRowActions.stylex";
import { CommunityFeed } from "./communityFeed.stylex";
import { LoadingList } from "./feedback.stylex";
import { ItemList, ItemListItem } from "./itemList.stylex";
import { BottleRailSection } from "./pages/bottleRailSection.stylex";
import { SearchSelect } from "./searchPicker.stylex";
import { SearchResults } from "./searchResults.stylex";
import { SectionHeading } from "./sectionHeading.stylex";
import { SelectedBottleSummary } from "./selectedBottleSummary.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";
import { TastingEntry } from "./tastingEntry.stylex";

const bottleActions = {
  groupsFor: () => [
    [{ label: "Rate this bottle", onSelect: () => undefined }],
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
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["standard", "search", "sidebar", "compact"],
    },
  },
  args: {
    ...toBottleListItem(rowBottle),
    href: "/bottles/19936",
    imageUrl: BottleImage.src,
  },
  parameters: {
    docs: {
      description: {
        component: `Use BottleIdentityRow for one bottle, BottleList for a catalog list, and CommunityFeed for activity. Build props with toBottleListItem (API Bottles) or getBottleIdentityProps (partial reads). All variants take the same full marketed name.

| Variant | Use | Content |
| --- | --- | --- |
| standard (default) | Catalog, tastings, reviews, and selection | Name, provenance, and release facts; 48 × 64px thumbnail (42 × 58px on mobile). |
| search | Typeahead results | Standard identity and thumbnail, 15px compact title, and 8px vertical padding. |
| sidebar | Sidebar bottle lists | 15px title limited to two lines, 32 × 46px thumbnail, and trailing content below the identity. |
| compact | Single or grouped library additions | One name line, 24 × 32px thumbnail, and a 44px hit area. |

Sidebar omits membership status icons and keeps full accessible names when its two-line titles truncate. Compact omits provenance, metadata, subtitle, status, and related releases. Long compact names truncate visually and retain their full accessible name and title. Use layout="cell" inside an existing control; end holds independent actions or scores. BottleVisual owns the image frame and fallback; the row chooses its size.

Use Row Layouts to compare these components at desktop and phone widths.`,
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

export const Compact: Story = {
  args: { variant: "compact" },
  render: (args) => (
    <ItemList ariaLabel="Compact bottle examples">
      <ItemListItem>
        <BottleIdentityRow {...args} />
      </ItemListItem>
      <ItemListItem>
        <BottleIdentityRow
          {...args}
          name="Lagavulin 16-year-old"
          href="/bottles/42"
          imageUrl={null}
        />
      </ItemListItem>
      <ItemListItem>
        <BottleIdentityRow
          {...args}
          name="Bruichladdich Octomore Edition 15.3 Islay Barley Super Heavily Peated"
          href="/bottles/18481"
          imageUrl={null}
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
          "Compare the actual bottle, sidebar, activity, tasting, search, selection, and loading components at wide and phone widths. Standard rows use three identity lines and a medium thumbnail. Sidebars use a small thumbnail, compact two-line titles, and trailing details below the identity. Compact library additions use the extra-small thumbnail.",
      },
    },
  },
  render: (args) => {
    const title = args.name;
    return (
      <StoryStack>
        <section aria-label="Bottle list">
          <SectionHeading level={3}>Bottle list</SectionHeading>
          <BottleIdentityRow {...args} />
        </section>
        <section aria-label="Library addition">
          <SectionHeading level={3}>Library addition</SectionHeading>
          <BottleIdentityRow {...args} variant="compact" />
        </section>
        <StoryCanvas width="compact">
          <BottleRailSection
            heading="Sidebar bottles"
            items={[
              { ...args, id: "sidebar-bottle" },
              {
                ...args,
                id: "sidebar-long-name",
                imageUrl: null,
                name: "Bruichladdich Octomore Edition 15.3 Islay Barley Super Heavily Peated",
              },
            ]}
          />
          <LoadingList
            label="Loading sidebar bottles"
            rows={2}
            variant="sidebar"
          />
        </StoryCanvas>
        <section aria-label="Activity">
          <SectionHeading level={3}>
            Activity on the homepage and activity page
          </SectionHeading>
          <CommunityFeed
            items={[
              {
                actor: "Whiskyfun",
                actorHref: "https://example.com/review",
                action: "published a review",
                kind: "critic_review",
                date: "2026-08-24T12:00:00.000Z",
                id: "review",
                bottles: [
                  {
                    ...args,
                    id: "bottle",
                    score: 88,
                    activityHref: "https://example.com/review",
                    activityLabel: "Read at Whiskyfun ↗",
                  },
                ],
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
                    title,
                    visual: {
                      kind: "bottle",
                      imageUrl: args.imageUrl,
                      label: title,
                    },
                  },
                  {
                    href: "/bottles/18481",
                    bottle: {
                      provenance: [{ name: "Single Malt" }],
                      metadata: ["61.5% ABV", "2024 release"],
                    },
                    id: "search-long-name",
                    title:
                      "Bruichladdich Octomore Edition 15.3 Islay Barley Super Heavily Peated",
                    visual: {
                      kind: "bottle",
                      imageUrl: null,
                      label: "Bruichladdich Octomore",
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
        <section aria-label="Picker selection">
          <SearchSelect
            label="Selected bottle in a picker"
            onChange={() => undefined}
            options={[toBottlePickerOption(rowBottle)]}
            placeholder="Search bottles"
            value={toBottlePickerOption(rowBottle)}
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
