import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas, StoryStack } from "../storyFixtures.stylex";
import {
  BottleComparisonTable,
  type BottleComparisonTableProps,
} from "./bottleComparisonTable.stylex";
import { BandStack } from "./scoring.stylex";

const rows: BottleComparisonTableProps["rows"] = [
  {
    href: "/bottles/1",
    id: "1",
    metadata: "Islay · 10 years · 46% ABV",
    name: "Port Charlotte 10 Year Old",
    values: [
      "84",
      <BandStack
        key="ratings"
        counts={{
          good: 19,
          mediocre: 14,
          outstanding: 18,
          unicorn: 4,
          very_good: 42,
        }}
        variant="compact"
      />,
    ],
  },
  {
    href: "/bottles/2",
    id: "2",
    metadata: "Islay · NAS · 54.2% ABV",
    name: "Ardbeg Uigeadail",
    values: [
      "89",
      <BandStack
        key="ratings"
        counts={{
          good: 14,
          mediocre: 9,
          outstanding: 34,
          unicorn: 9,
          very_good: 46,
        }}
        variant="compact"
      />,
    ],
  },
  {
    href: "/bottles/3",
    id: "3",
    metadata: "Islay · 12 years · 43% ABV",
    name: "Caol Ila 12 Year Old",
    values: [null, <BandStack key="ratings" counts={{}} variant="compact" />],
  },
];

const meta = {
  title: "Components/Data Display/Bottle Comparison Table",
  component: BottleComparisonTable,
  args: {
    columns: ["Score", "Tasting ratings"],
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
  render: (args) => (
    <StoryStack>
      <BottleComparisonTable {...args} />
      <BottleComparisonTable
        {...args}
        ariaLabel="Associated bottles"
        detail={undefined}
        heading={undefined}
      />
      <BottleComparisonTable
        {...args}
        rows={[
          {
            href: "/bottles/4",
            id: "4",
            metadata: "Campbeltown · 15 years · 51.4% ABV",
            name: "A deliberately long independent bottling name that tests the aligned row",
            values: [
              "91",
              <BandStack
                key="ratings"
                counts={{
                  good: 3,
                  mediocre: 2,
                  outstanding: 11,
                  unicorn: 4,
                  very_good: 10,
                }}
                variant="compact"
              />,
            ],
          },
        ]}
      />
    </StoryStack>
  ),
};
