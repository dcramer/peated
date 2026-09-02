import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { getRegionMap } from "../lib/locationMap";
import { LocationPreviewCard } from "./locationPreviewCard.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Places/Location Preview Card",
  component: LocationPreviewCard,
  args: {
    description:
      "An island region known for smoky single malt whisky and long-running distilleries.",
    href: "#islay",
    name: "Islay",
    totalBottles: 680,
    visual: getRegionMap("scotland", "islay"),
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof LocationPreviewCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

export const WithoutMap: Story = {
  args: {
    description: "A whisky region in northeastern Scotland.",
    href: "#speyside",
    name: "Speyside",
    totalBottles: 1240,
    visual: getRegionMap("scotland", "speyside"),
  },
};

export const LongDescription: Story = {
  args: {
    description: `${meta.args.description} `.repeat(8).trim(),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Long text stays within three lines without changing the card height.",
      },
    },
  },
};
