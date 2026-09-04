import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { BottleRatingSummary } from "./scoring.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Ratings/Bottle Rating Summary",
  component: BottleRatingSummary,
  args: {
    externalScoreCount: 2,
    memberScoreCount: 3,
    median: 91,
    reviewCounts: { outstanding: 4, very_good: 1 },
    tastingCounts: { good: 1, outstanding: 5, unicorn: 2, very_good: 2 },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Use once in a bottle header. The rating name always matches the middle review score. With tastings only, it shows the middle tasting's full range instead of an exact score.",
      },
    },
  },
} satisfies Meta<typeof BottleRatingSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <BottleRatingSummary {...args} />
      <BottleRatingSummary
        externalScoreCount={2}
        median={86}
        reviewCounts={{ good: 1, outstanding: 1 }}
      />
      <BottleRatingSummary
        tastingCounts={{ outstanding: 2, unicorn: 1, very_good: 4 }}
      />
      <BottleRatingSummary />
    </StoryStack>
  ),
};
