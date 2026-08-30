import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { LocationCard } from "./locationCard.stylex";

const meta = {
  title: "Components/Data Display/Location Card",
  component: LocationCard,
  args: {
    href: "#scotland",
    name: "Scotland",
    slug: "scotland",
    summary:
      "Home to distinct whisky regions, long-running distilleries, and independent bottlers.",
    totalBottles: 18_420,
    totalDistillers: 142,
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof LocationCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
