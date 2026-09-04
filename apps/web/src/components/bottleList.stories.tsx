import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import BottleImage from "../../../../packages/bottle-classifier/src/eval-fixtures/assets/photo-add-bottle-misses/laphroaig-elements-l2.0.webp";
import { BottleList, type BottleListProps } from "./bottleList.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const items: BottleListProps["items"] = [
  {
    href: "/bottles/1",
    id: "1",
    imageUrl: BottleImage.src,
    metadata: ["Single Malt", "10 years", "46% ABV"],
    name: "Port Charlotte 10-year-old",
    ratings: {
      median: 84,
      reviewCounts: {
        good: 8,
        mediocre: 4,
        outstanding: 3,
        unicorn: 1,
        very_good: 12,
      },
      scoreCount: 28,
      tastingCounts: {
        good: 19,
        mediocre: 14,
        outstanding: 18,
        unicorn: 4,
        very_good: 42,
      },
    },
  },
  {
    href: "/bottles/2",
    id: "2",
    metadata: ["Single Malt", "NAS", "54.2% ABV"],
    name: "Ardbeg Uigeadail",
    ratings: {
      median: 89,
      reviewCounts: {
        good: 6,
        mediocre: 2,
        outstanding: 17,
        unicorn: 5,
        very_good: 24,
      },
      scoreCount: 54,
      tastingCounts: {
        good: 14,
        mediocre: 9,
        outstanding: 34,
        unicorn: 9,
        very_good: 46,
      },
    },
  },
  {
    href: "/bottles/3",
    id: "3",
    metadata: ["Single Malt", "12 years", "43% ABV"],
    name: "Caol Ila 12-year-old",
    ratings: { tastingCounts: { outstanding: 3, very_good: 1 } },
  },
  {
    align: "start",
    href: "/bottles/4",
    id: "4",
    metadata: ["2026 release", "15 years", "51.4% ABV"],
    name: "A deliberately long independent bottle name that tests the shared row",
    subtitle: "Highland · Single Malt",
  },
];

const meta = {
  title: "Components/Bottles/Bottle List",
  component: BottleList,
  args: {
    ariaLabel: "Bottle examples",
    items,
  },
  argTypes: { items: { control: false } },
  parameters: {
    docs: {
      description: {
        component:
          "Use for catalog results and other lists of bottles. Build items with toBottleListItem; BottleIdentityRow owns each identity and thumbnail. Ratings are optional, and an explicit end action takes their place. Use CommunityFeed for grouped activity and BottleRailSection for a sidebar list. See Bottle Identity Row / Row Layouts for the shared layout reference.",
      },
    },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<BottleListProps>;

export default meta;
type Story = StoryObj<BottleListProps>;

export const Overview: Story = {};

export const InteractionStates: Story = {
  parameters: {
    pseudo: {
      active: ["li:nth-child(4) > div"],
      focusWithin: ["li:nth-child(3) > div"],
      hover: ["li:nth-child(2) > div"],
    },
  },
};
