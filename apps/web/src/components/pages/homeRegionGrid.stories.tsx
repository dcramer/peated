import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { getRegionMap } from "../../lib/locationMap";
import { StoryCanvas } from "../storyFixtures.stylex";
import { HomeRegionGrid } from "./homeBrowse.stylex";

const meta = {
  title: "Components/Places/Region Grid",
  component: HomeRegionGrid,
  parameters: {
    docs: {
      description: {
        component:
          "Region cards shared by the homepage and country overview. Scottish regions have illustrative silhouettes and map credits. Regions without an asset remain text-only.",
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
} satisfies Meta<typeof HomeRegionGrid>;

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
