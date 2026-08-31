import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TastingRatingDistribution } from "./scoring.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const counts = {
  good: 568,
  mediocre: 312,
  outstanding: 796,
  unicorn: 199,
  very_good: 966,
};

const meta = {
  title: "Components/Ratings/Tasting Rating Distribution",
  component: TastingRatingDistribution,
  args: { counts, showCounts: true },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof TastingRatingDistribution>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <TastingRatingDistribution {...args} />
      <TastingRatingDistribution counts={{}} />
    </StoryStack>
  ),
};
