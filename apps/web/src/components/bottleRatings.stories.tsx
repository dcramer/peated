import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { BottleRatings } from "./scoring.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Ratings/Bottle Ratings",
  component: BottleRatings,
  args: {
    median: 91,
    reviewCounts: {
      good: 0,
      mediocre: 0,
      outstanding: 4,
      unicorn: 0,
      very_good: 1,
    },
    scoreCount: 5,
    tastingCounts: {
      good: 1,
      mediocre: 0,
      outstanding: 5,
      unicorn: 2,
      very_good: 2,
    },
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
          "Use at the end of a bottle row. It shows the middle review score when one exists. With tastings only, it shows the middle tasting's full range. The bar includes member reviews, critic reviews, and tastings. Bottles with no ratings show nothing.",
      },
    },
  },
} satisfies Meta<typeof BottleRatings>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <BottleRatings {...args} />
      <BottleRatings
        median={86}
        reviewCounts={{ good: 1, outstanding: 1, very_good: 3 }}
        scoreCount={5}
      />
      <BottleRatings
        tastingCounts={{ outstanding: 2, unicorn: 1, very_good: 4 }}
      />
      <BottleRatings />
    </StoryStack>
  ),
};
