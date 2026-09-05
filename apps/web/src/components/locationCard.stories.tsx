import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LocationCard, LocationCardLoading } from "./locationCard.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Places/Location Card",
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

export const Loading: Story = {
  render: () => <LocationCardLoading />,
};
