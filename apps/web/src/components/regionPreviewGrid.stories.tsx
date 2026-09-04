import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { getRegionMap } from "../lib/locationMap";
import { RegionPreviewGrid } from "./locationPreviewCard.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Places/Region Grid",
  component: RegionPreviewGrid,
  parameters: {
    docs: {
      description: {
        component:
          "Region cards used on the homepage and country pages. Scottish regions include map shapes and a source credit. Regions without a map still show their names and bottle counts.",
      },
    },
  },
  args: {
    regions: [
      ["Highland", "highland"],
      ["Speyside", "speyside"],
      ["Lowland", "lowland"],
      ["Islay", "islay"],
      ["Campbeltown", "campbeltown"],
      ["Islands", "islands"],
    ].map(([name, slug]) => ({
      href: `/locations/scotland/regions/${slug}`,
      name,
      visual: getRegionMap("scotland", slug),
      totalBottles: 120,
    })),
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof RegionPreviewGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

export const WithoutMap: Story = {
  args: {
    regions: [
      {
        href: "/locations/japan/regions/hokkaido",
        name: "Hokkaido",
        visual: null,
        totalBottles: 30,
      },
    ],
  },
};
