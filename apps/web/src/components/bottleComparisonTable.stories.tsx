import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import BottleImage from "../../../../packages/bottle-classifier/src/eval-fixtures/assets/photo-add-bottle-misses/laphroaig-elements-l2.0.webp";
import {
  BottleComparisonTable,
  type BottleComparisonTableProps,
} from "./bottleComparisonTable.stylex";
import { BottleRatings } from "./scoring.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const rows: BottleComparisonTableProps["rows"] = [
  {
    brand: "Port Charlotte",
    href: "/bottles/1",
    id: "1",
    imageUrl: BottleImage.src,
    metadata: ["Single Malt", "10 years", "46% ABV"],
    name: "10 Year Old",
    values: [
      <BottleRatings
        counts={{
          good: 19,
          mediocre: 14,
          outstanding: 18,
          unicorn: 4,
          very_good: 42,
        }}
        high={94}
        key="rating"
        low={77}
        median={84}
        scoreCount={28}
      />,
    ],
  },
  {
    brand: "Ardbeg",
    href: "/bottles/2",
    id: "2",
    metadata: ["Single Malt", "No age statement", "54.2% ABV"],
    name: "Uigeadail",
    values: [
      <BottleRatings
        counts={{
          good: 14,
          mediocre: 9,
          outstanding: 34,
          unicorn: 9,
          very_good: 46,
        }}
        high={98}
        key="rating"
        low={80}
        median={89}
        scoreCount={54}
      />,
    ],
  },
  {
    brand: "Caol Ila",
    href: "/bottles/3",
    id: "3",
    metadata: ["Single Malt", "12 years", "43% ABV"],
    name: "12 Year Old",
    values: [<BottleRatings counts={{}} key="rating" />],
  },
  {
    brand: "Independent Bottler",
    href: "/bottles/4",
    id: "4",
    metadata: ["Single Malt", "15 years", "51.4% ABV"],
    name: "A deliberately long independent bottle name that tests the aligned row",
    values: [
      <BottleRatings
        counts={{
          good: 3,
          mediocre: 2,
          outstanding: 11,
          unicorn: 4,
          very_good: 10,
        }}
        high={97}
        key="rating"
        low={82}
        median={91}
        scoreCount={22}
      />,
    ],
  },
];

const meta = {
  title: "Components/Bottles/Bottle Comparison Table",
  component: BottleComparisonTable,
  args: {
    columns: ["Rating"],
    detail: "3 bottles in this set",
    heading: "Islay single malts",
    rows,
  },
  argTypes: { rows: { control: false } },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<BottleComparisonTableProps>;

export default meta;
type Story = StoryObj<BottleComparisonTableProps>;

export const Overview: Story = {
  render: (args) => <BottleComparisonTable {...args} />,
};

export const InteractionStates: Story = {
  render: (args) => <BottleComparisonTable {...args} />,
  parameters: {
    pseudo: {
      active: ['tr[data-record-key="4"]'],
      focusWithin: ['tr[data-record-key="3"]'],
      hover: ['tr[data-record-key="2"]'],
    },
  },
};
