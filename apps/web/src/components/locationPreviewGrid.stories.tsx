import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { getRegionMap } from "../lib/locationMap";
import {
  LocationPreviewGrid,
  RegionPreviewGridLoading,
} from "./locationPreviewCard.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Places/Location Preview Grid",
  component: LocationPreviewGrid,
  parameters: {
    docs: {
      description: {
        component:
          "Location cards use the same layout. Show descriptions for places such as regions, or hide them for shorter country cards.",
      },
    },
  },
  args: {
    locations: [
      {
        description: "An island region known for smoky single malt whisky.",
        href: "#islay",
        name: "Islay",
        totalBottles: 680,
        visual: getRegionMap("scotland", "islay"),
      },
      {
        description: "A region with a long history of whisky production.",
        href: "#highland",
        name: "Highland",
        totalBottles: 1_490,
        visual: getRegionMap("scotland", "highland"),
      },
    ],
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof LocationPreviewGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

export const WithoutDescriptions: Story = {
  args: {
    showDescriptions: false,
  },
};

export const Loading: Story = {
  render: () => <RegionPreviewGridLoading />,
};
