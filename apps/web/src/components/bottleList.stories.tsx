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
      counts: {
        good: 19,
        mediocre: 14,
        outstanding: 18,
        unicorn: 4,
        very_good: 42,
      },
      high: 94,
      low: 77,
      median: 84,
      scoreCount: 28,
    },
  },
  {
    href: "/bottles/2",
    id: "2",
    metadata: ["Single Malt", "No age statement", "54.2% ABV"],
    name: "Ardbeg Uigeadail",
    ratings: {
      counts: {
        good: 14,
        mediocre: 9,
        outstanding: 34,
        unicorn: 9,
        very_good: 46,
      },
      high: 98,
      low: 80,
      median: 89,
      scoreCount: 54,
    },
  },
  {
    href: "/bottles/3",
    id: "3",
    metadata: ["Single Malt", "12 years", "43% ABV"],
    name: "Caol Ila 12-year-old",
    ratings: { counts: {} },
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
